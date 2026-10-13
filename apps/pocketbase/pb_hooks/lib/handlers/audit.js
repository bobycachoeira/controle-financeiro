const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);

// Registra um evento de auditoria enviado pelo cliente (ex.: resolução de
// conflito de sincronização). Restrito a membros do household.
function record(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");

  const data = http.requestBody(c);
  let household = String(data.household || "");
  if (!household) {
    try {
      const member = $app.findFirstRecordByFilter("household_members", "user = {:user}", {
        user: user.id,
      });
      if (member && !http.isDeleted(member)) household = member.getString("household");
    } catch (err) {
      household = "";
    }
  }
  if (!household) return http.fail(c, 400, "no_household", "Sem household");

  const access = auth.membershipError(c, $app, user.id, household);
  if (access.status) return http.fail(c, access.status, access.code, access.message);

  const action = String(data.action || "").slice(0, 80);
  if (!action) return http.fail(c, 400, "invalid_action", "Ação inválida");

  audit.writeAudit($app, {
    household: household,
    user: user.id,
    action: action,
    entity: String(data.entity || "").slice(0, 60),
    entityId: String(data.entity_id || "").slice(0, 40),
    before: data.before || {},
    after: data.after || {},
    ip: http.clientIp(c),
    userAgent: http.clientUserAgent(c),
  });

  return http.ok(c, { ok: true });
}

function userName(userId) {
  try {
    return $app.findRecordById("users", userId).getString("name");
  } catch (err) {
    return "";
  }
}

// Lista a auditoria do household (somente titular ou membro com permissão `audit`).
function list(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");

  const query = http.queryParams(c);
  let household = String(query.household || "");
  if (!household) {
    try {
      const member = $app.findFirstRecordByFilter("household_members", "user = {:user}", {
        user: user.id,
      });
      if (member && !http.isDeleted(member)) household = member.getString("household");
    } catch (err) {
      household = "";
    }
  }
  if (!household) return http.fail(c, 400, "no_household", "Sem household");

  const access = auth.membershipError(c, $app, user.id, household);
  if (access.status) return http.fail(c, access.status, access.code, access.message);

  const member = auth.findMembership($app, user.id, household);
  const permissions = member ? http.jsonField(member, "permissions") : {};
  if (access.role !== "owner" && permissions.audit !== true) {
    return http.fail(c, 403, "forbidden", "Sem permissão para ver a auditoria");
  }

  const page = Math.max(1, Number(query.page || 1) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.perPage || 30) || 30));
  const action = String(query.action || "").toLowerCase();
  const entity = String(query.entity || "");
  const userId = String(query.user || "");
  const from = String(query.from || "");
  const to = String(query.to || "");

  let records = $app
    .findAllRecords(
      $app.findCollectionByNameOrId("audit_logs"),
      $dbx.hashExp({ household: household }),
    )
    .filter((record) => {
      if (action && record.getString("action").toLowerCase().indexOf(action) === -1) return false;
      if (entity && record.getString("entity") !== entity) return false;
      if (userId && record.getString("user") !== userId) return false;
      const created = record.getString("created").slice(0, 10);
      if (from && created < from) return false;
      if (to && created > to) return false;
      return true;
    })
    .sort((a, b) => (a.getString("created") < b.getString("created") ? 1 : -1));

  const total = records.length;
  const start = (page - 1) * perPage;
  const items = records.slice(start, start + perPage).map((record) => ({
    id: record.id,
    action: record.getString("action"),
    entity: record.getString("entity"),
    entity_id: record.getString("entity_id"),
    user: record.getString("user"),
    user_name: userName(record.getString("user")),
    before: record.get("before") || {},
    after: record.get("after") || {},
    created: record.getString("created"),
  }));

  return http.ok(c, { items: items, total: total, page: page, perPage: perPage });
}

module.exports = { record, list };
