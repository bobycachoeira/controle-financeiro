const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const permissions = require(`${__hooks}/lib/permissions.js`);
const shared = require(`${__hooks}/lib/shared.js`);
const ratelimit = require(`${__hooks}/lib/ratelimit.js`);
const invoiceDomain = require(`${__hooks}/lib/domain/invoice.js`);
const billDomain = require(`${__hooks}/lib/domain/bill.js`);
const categoryDomain = require(`${__hooks}/lib/domain/category.js`);
const transferDomain = require(`${__hooks}/lib/domain/transfer.js`);

const SYSTEM_FIELDS = ["id", "created", "updated", "collectionId", "collectionName"];
const PROTECTED = ["household", "sync_id", "updated_by", "deleted_at"];
const FINANCE_MANAGE = ["accounts", "credit_cards", "categories", "recurrences", "budgets", "exchange_rates"];
const MOVEMENTS = ["transactions", "installments", "invoices", "transfers", "bills"];

function findExisting(entity, id) {
  try {
    return $app.findRecordById(entity, id);
  } catch (err) {
    return null;
  }
}

function discardPendingDeliveries(entity, entityId) {
  try {
    const records = $app.findAllRecords(
      $app.findCollectionByNameOrId("notification_deliveries"),
      $dbx.hashExp({ entity: entity, entity_id: entityId }),
    );
    for (let index = 0; index < records.length; index += 1) {
      if (records[index].getString("status") === "pendente") {
        records[index].set("status", "descartado");
        $app.save(records[index]);
      }
    }
  } catch (err) {
    // coleção pode não existir em ambientes antigos
  }
}

function existingEvent(household, entity, syncId) {
  try {
    return $app.findFirstRecordByFilter(
      "sync_events",
      "household = {:household} && entity = {:entity} && sync_id = {:syncId}",
      { household: household, entity: entity, syncId: syncId },
    );
  } catch (err) {
    return null;
  }
}

function serialize(record) {
  try {
    return record.publicExport();
  } catch (err) {
    return { id: record.id };
  }
}

function setWhitelistedFields(record, collection, payload) {
  const fields = collection.fields;
  for (let index = 0; index < fields.length; index += 1) {
    const name = fields[index].name;
    if (SYSTEM_FIELDS.indexOf(name) !== -1) continue;
    if (PROTECTED.indexOf(name) !== -1) continue;
    if (payload[name] === undefined) continue;
    record.set(name, payload[name]);
  }
}

function validatePayload(entity, payload) {
  const schemaMap = {
    accounts: shared.accountSchema,
    credit_cards: shared.creditCardSchema,
    categories: shared.categorySchema,
    transactions: shared.transactionSchema,
    installments: shared.installmentSchema,
    invoices: shared.invoiceSchema,
    transfers: shared.transferSchema,
    bills: shared.billSchema,
    recurrences: shared.recurrenceSchema,
    budgets: shared.budgetSchema,
    exchange_rates: shared.exchangeRateSchema,
    households: shared.householdSchema,
    household_members: shared.householdMemberSchema,
  };
  const schema = schemaMap[entity];
  if (!schema) return { ok: true };
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  return { ok: true, data: parsed.data };
}

function capabilityError(entity, role, userId, payload) {
  if (FINANCE_MANAGE.indexOf(entity) !== -1) {
    return permissions.canManageFinance(role) ? null : { status: 403, code: "forbidden", message: "Sem permissão sobre cadastros" };
  }
  if (entity === "household_members" || entity === "households") {
    return permissions.canManageMembers(role) ? null : { status: 403, code: "forbidden", message: "Sem permissão sobre membros" };
  }
  if (MOVEMENTS.indexOf(entity) !== -1) {
    const isOwn = !payload || !payload.payer_user || payload.payer_user === userId;
    return permissions.canWriteTransactions(role, isOwn) ? null : { status: 403, code: "forbidden", message: "Sem permissão sobre movimentações" };
  }
  return { status: 403, code: "forbidden", message: "Entidade não permitida" };
}

function applyOperation(household, userId, role, operation) {
  const entity = operation.entity;
  const previous = existingEvent(household, entity, operation.sync_id);
  if (previous) {
    return {
      sync_id: operation.sync_id,
      entity: entity,
      status: previous.getString("result") || "ignored",
      remote_id: previous.getString("entity_id") || null,
      code: "idempotent",
      conflict: false,
    };
  }

  const payload = operation.payload || {};
  const validation = validatePayload(
    entity,
    Object.assign({}, payload, { household: household, sync_id: payload.sync_id || operation.sync_id }),
  );
  if (!validation.ok && operation.operation !== "delete") {
    const issues = validation.issues || [];
    const first = issues[0];
    const field = first && first.path && first.path.length ? first.path.join(".") : "";
    const message = first
      ? `Payload inválido${field ? " em " + field : ""}: ${first.message}`
      : "Payload inválido";
    return {
      sync_id: operation.sync_id,
      entity: entity,
      status: "error",
      conflict: false,
      code: "validation_error",
      message: message,
      details: issues,
    };
  }

  const capError = capabilityError(entity, role, userId, payload);
  if (capError) {
    return {
      sync_id: operation.sync_id,
      entity: entity,
      status: "error",
      conflict: false,
      code: capError.code,
      message: capError.message,
    };
  }

  const collection = $app.findCollectionByNameOrId(entity);
  const result = { sync_id: operation.sync_id, entity: entity, conflict: false };

  if (entity === "transfers" && operation.operation === "create") {
    const validation = transferDomain.validateTransfer(payload);
    if (!validation.valid) {
      result.status = "error";
      result.code = validation.error === "same_account" ? "same_account" : "invalid_amount";
      result.message = "Transferência inválida";
      return result;
    }
  }

  if (entity === "categories" && operation.operation === "delete") {
    const category = findExisting(entity, operation.entity_id);
    if (category && !categoryDomain.canDelete(category)) {
      result.status = "error";
      result.code = "system_category";
      result.message = "Categoria de sistema não pode ser excluída";
      return result;
    }
  }

  if (entity === "bills" && operation.operation === "update" && operation.entity_id) {
    const bill = findExisting(entity, operation.entity_id);
    if (bill && payload.status && bill.getString("status") !== payload.status) {
      if (!billDomain.canTransition(bill.getString("status"), payload.status)) {
        result.status = "error";
        result.code = "invalid_transition";
        result.message = "Transição de status inválida";
        return result;
      }
    }
  }

  if (operation.operation === "create") {
    const record = new Record(collection);
    const clientId = operation.entity_id || "";
    if (clientId && /^[a-z0-9]{1,15}$/.test(clientId)) record.id = clientId;
    setWhitelistedFields(record, collection, payload);
    record.set("household", household);
    record.set("sync_id", payload.sync_id || operation.sync_id);
    record.set("updated_by", userId);
    record.set("deleted_at", null);
    $app.save(record);
    result.status = "applied";
    result.remote_id = record.id;
    result.record = serialize(record);
    if (entity === "transactions" && record.get("invoice")) {
      invoiceDomain.recalcInvoice($app, record.getString("invoice"));
    }
  } else if (operation.operation === "update") {
    const record = findExisting(entity, operation.entity_id);
    if (!record || http.isDeleted(record)) {
      result.status = "ignored";
      result.code = "orphan_update_discarded";
      return result;
    }
    const decision = shared.resolveConflict({
      clientUpdatedAt: operation.client_ts,
      serverUpdatedAt: record.getString("updated") || "1970-01-01T00:00:00.000Z",
    });
    if (decision.winner === "client") {
      setWhitelistedFields(record, collection, payload);
      record.set("updated_by", userId);
      $app.save(record);
      result.status = "applied";
      result.remote_id = record.id;
      result.record = serialize(record);
      if (entity === "transactions" && record.get("invoice")) {
        invoiceDomain.recalcInvoice($app, record.getString("invoice"));
      }
      if (
        (entity === "bills" || entity === "invoices") &&
        (payload.status === "pago" || payload.status === "cancelado" || payload.status === "paga")
      ) {
        discardPendingDeliveries(entity, record.id);
      }
    } else {
      result.status = "conflict";
      result.conflict = true;
      result.code = "conflict_kept_server";
      result.remote_id = record.id;
      result.record = serialize(record);
    }
  } else {
    const record = findExisting(entity, operation.entity_id);
    if (!record) {
      result.status = "ignored";
      result.code = "not_found";
      return result;
    }
    record.set("deleted_at", new Date().toISOString());
    record.set("updated_by", userId);
    $app.save(record);
    audit.writeAudit($app, {
      household: household,
      user: userId,
      action: entity + ".delete",
      entity: entity,
      entityId: record.id,
    });
    result.status = "applied";
    result.remote_id = record.id;
    if (entity === "transactions" && record.get("invoice")) {
      invoiceDomain.recalcInvoice($app, record.getString("invoice"));
    }
    if (entity === "bills" || entity === "invoices") {
      discardPendingDeliveries(entity, record.id);
    }
  }

  const event = new Record($app.findCollectionByNameOrId("sync_events"));
  event.set("household", household);
  event.set("user", userId);
  event.set("entity", entity);
  event.set("entity_id", result.remote_id || operation.entity_id || "");
  event.set("sync_id", operation.sync_id);
  event.set("operation", operation.operation);
  event.set("client_ts", operation.client_ts);
  event.set("server_ts", new Date().toISOString());
  event.set("result", result.status);
  event.set("detail", { code: result.code || "" });
  $app.save(event);

  return result;
}

function push(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const limit = ratelimit.rateLimit("sync:" + user.id, 60, 60 * 1000);
  if (!limit.allowed) return http.fail(c, 429, "rate_limited", "Muitas sincronizações");

  const data = http.requestBody(c);
  const household = String(data.household || "");
  const access = auth.membershipError(c, $app, user.id, household);
  if (access.status) {
    http.log("sync.push.denied", { userId: user.id, household: household, code: access.code });
    audit.writeAudit($app, { household: household, user: user.id, action: "sync.push.denied", entity: "sync_events", ip: http.clientIp(c) });
    return http.fail(c, access.status, access.code, access.message);
  }

  const operations = data.operations || [];
  if (!operations.length || operations.length > 100) {
    return http.fail(c, 400, "invalid_batch", "Lote inválido");
  }

  const results = [];
  for (let index = 0; index < operations.length; index += 1) {
    try {
      results.push(applyOperation(household, user.id, access.role, operations[index]));
    } catch (err) {
      results.push({
        sync_id: operations[index].sync_id,
        entity: operations[index].entity,
        status: "error",
        conflict: false,
        code: "apply_error",
        message: String(err),
      });
    }
  }
  return http.ok(c, { results: results, server_seq: Date.now() });
}

const SYNC_ENTITIES = [
  "household_members",
  "accounts",
  "credit_cards",
  "categories",
  "transactions",
  "installments",
  "invoices",
  "transfers",
  "bills",
  "recurrences",
  "budgets",
  "exchange_rates",
];

function pull(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const query = http.queryParams(c);
  let household = String(query.household || "");
  const sinceMs = Number(query.since || 0);
  const limit = Math.min(Number(query.limit || 200), 500);

  if (!household) {
    try {
      const member = $app.findFirstRecordByFilter("household_members", "user = {:user}", {
        user: user.id,
      });
      if (member && !http.isDeleted(member)) {
        household = member.getString("household");
      }
    } catch (err) {
      household = "";
    }
  }

  const access = auth.membershipError(c, $app, user.id, household);
  if (access.status) return http.fail(c, access.status, access.code, access.message);

  const sinceDate = new Date(sinceMs > 0 ? sinceMs : 0).toISOString();
  let maxMs = sinceMs;
  const changes = [];

  for (let e = 0; e < SYNC_ENTITIES.length; e += 1) {
    const entity = SYNC_ENTITIES[e];
    let records = [];
    try {
      records = $app.findAllRecords(
        $app.findCollectionByNameOrId(entity),
        $dbx.hashExp({ household: household }),
      );
    } catch (err) {
      records = [];
    }
    for (let i = 0; i < records.length; i += 1) {
      const record = records[i];
      const updatedMs = new Date(record.getString("updated")).getTime();
      if (!Number.isNaN(updatedMs) && updatedMs < sinceMs) continue;
      if (updatedMs > maxMs) maxMs = updatedMs;
      changes.push({
        entity: entity,
        id: record.id,
        seq: Number.isNaN(updatedMs) ? 0 : updatedMs,
        deleted: http.isDeleted(record),
        record: serialize(record),
      });
    }
  }

  try {
    const householdRecord = $app.findRecordById("households", household);
    if (householdRecord) {
      const updatedMs = new Date(householdRecord.getString("updated")).getTime();
      if (updatedMs >= sinceMs) {
        if (updatedMs > maxMs) maxMs = updatedMs;
        changes.push({
          entity: "households",
          id: householdRecord.id,
          seq: updatedMs,
          deleted: http.isDeleted(householdRecord),
          record: serialize(householdRecord),
        });
      }
    }
  } catch (err) {
    // household not found; ignore
  }

  return http.ok(c, {
    server_seq: maxMs,
    has_more: false,
    changes: changes,
  });
}

module.exports = { push, pull };
