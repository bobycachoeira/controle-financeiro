const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const shared = require(`${__hooks}/lib/shared.js`);

const DEFAULT_PREFS = shared.DEFAULT_NOTIFICATION_PREFERENCES;

function firstHousehold(userId) {
  try {
    const member = $app.findFirstRecordByFilter("household_members", "user = {:user}", {
      user: userId,
    });
    if (member && !http.isDeleted(member)) return member.getString("household");
  } catch (err) {
    // sem household
  }
  return "";
}

function resolveContext(c, user) {
  const query = http.queryParams(c);
  const body = http.requestBody(c);
  let household = String(body.household || query.household || "");
  if (!household) household = firstHousehold(user.id);
  const access = auth.membershipError(c, $app, user && user.id, household);
  if (access.status) return { error: access };
  return { household: household, role: access.role };
}

function findPreferences(household, userId) {
  try {
    return $app.findFirstRecordByFilter(
      "notification_preferences",
      "household = {:household} && user = {:user}",
      { household: household, user: userId },
    );
  } catch (err) {
    return null;
  }
}

function activeSubscriptions(household, userId) {
  return $app
    .findAllRecords(
      $app.findCollectionByNameOrId("push_subscriptions"),
      $dbx.hashExp({ household: household, user: userId }),
    )
    .filter((row) => !row.getString("revoked_at"));
}

function normalizePreferences(raw) {
  const parsed = shared.notificationPreferencesSchema.safeParse(raw || {});
  if (!parsed.success) return { ok: false, issues: parsed.error.issues };
  const prefs = parsed.data;
  shared.REMINDER_TYPES.forEach((type) => {
    prefs[type].dias_antes = shared.validateReminderDays(type, prefs[type].dias_antes);
  });
  return { ok: true, data: prefs };
}

function vapidPublicKey(c) {
  return http.ok(c, { public_key: $os.getenv("CF_VAPID_PUBLIC_KEY") || "" });
}

function getPreferences(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);
  const record = findPreferences(ctx.household, user.id);
  const subscriptions = activeSubscriptions(ctx.household, user.id);
  return http.ok(c, {
    push_enabled: record ? record.getBool("push_enabled") : false,
    preferences: record ? normalizePreferences(record.get("preferences")).data || DEFAULT_PREFS : DEFAULT_PREFS,
    subscriptions_count: subscriptions.length,
  });
}

function updatePreferences(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);
  const body = http.requestBody(c);
  const normalized = normalizePreferences(body.preferences);
  if (!normalized.ok) {
    return http.fail(c, 400, "invalid_preferences", "Preferências inválidas", normalized.issues);
  }
  let record = findPreferences(ctx.household, user.id);
  if (!record) {
    record = new Record($app.findCollectionByNameOrId("notification_preferences"));
    record.set("household", ctx.household);
    record.set("user", user.id);
  }
  record.set("preferences", normalized.data);
  if (body.push_enabled !== undefined) record.set("push_enabled", Boolean(body.push_enabled));
  $app.save(record);
  audit.writeAudit($app, {
    household: ctx.household,
    user: user.id,
    action: "notifications.preferences.update",
    entity: "notification_preferences",
    entityId: record.id,
  });
  return http.ok(c, { push_enabled: record.getBool("push_enabled"), preferences: normalized.data });
}

function createSubscription(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);
  const body = http.requestBody(c);
  const endpoint = String(body.endpoint || "");
  const keys = body.keys || {};
  if (!endpoint || !keys.p256dh || !keys.auth) {
    return http.fail(c, 400, "invalid_subscription", "Inscrição inválida");
  }

  let record = null;
  try {
    record = $app.findFirstRecordByFilter("push_subscriptions", "endpoint = {:endpoint}", {
      endpoint: endpoint,
    });
  } catch (err) {
    record = null;
  }
  if (!record) {
    record = new Record($app.findCollectionByNameOrId("push_subscriptions"));
  }
  record.set("household", ctx.household);
  record.set("user", user.id);
  record.set("endpoint", endpoint);
  record.set("p256dh", String(keys.p256dh));
  record.set("auth", String(keys.auth));
  record.set("label", String(body.label || "Dispositivo").slice(0, 80));
  record.set("user_agent", http.clientUserAgent(c));
  record.set("last_seen_at", new Date().toISOString());
  record.set("revoked_at", null);
  $app.save(record);

  let prefs = findPreferences(ctx.household, user.id);
  if (!prefs) {
    prefs = new Record($app.findCollectionByNameOrId("notification_preferences"));
    prefs.set("household", ctx.household);
    prefs.set("user", user.id);
    prefs.set("preferences", DEFAULT_PREFS);
  }
  prefs.set("push_enabled", true);
  $app.save(prefs);

  audit.writeAudit($app, {
    household: ctx.household,
    user: user.id,
    action: "notifications.subscription.create",
    entity: "push_subscriptions",
    entityId: record.id,
  });
  return http.ok(
    c,
    {
      subscription: {
        id: record.id,
        label: record.getString("label"),
        last_seen_at: record.get("last_seen_at"),
        revoked_at: null,
      },
    },
    201,
  );
}

function deleteSubscription(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  let record;
  try {
    record = $app.findRecordById("push_subscriptions", http.pathParam(c, "id"));
  } catch (err) {
    return http.fail(c, 404, "not_found", "Inscrição não encontrada");
  }
  if (record.getString("user") !== user.id) {
    return http.fail(c, 403, "forbidden", "Inscrição de outro usuário");
  }
  record.set("revoked_at", new Date().toISOString());
  $app.save(record);
  audit.writeAudit($app, {
    household: record.getString("household"),
    user: user.id,
    action: "notifications.subscription.revoke",
    entity: "push_subscriptions",
    entityId: record.id,
  });
  return c.noContent(204);
}

function testNotification(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);
  if (activeSubscriptions(ctx.household, user.id).length === 0) {
    return http.fail(c, 409, "no_subscription", "Nenhuma inscrição ativa");
  }
  const delivery = new Record($app.findCollectionByNameOrId("notification_deliveries"));
  delivery.set("household", ctx.household);
  delivery.set("user", user.id);
  delivery.set("kind", "teste");
  delivery.set("entity", "teste");
  delivery.set("entity_id", $security.randomString(15));
  delivery.set("scheduled_date", new Date().toISOString());
  delivery.set("title", "Notificação de teste");
  delivery.set("amount_cents", 0);
  delivery.set("status", "pendente");
  delivery.set("attempts", 0);
  $app.save(delivery);
  return http.ok(c, { ok: true, delivery_id: delivery.id }, 202);
}

/**
 * "Pedir cobertura": manda um push para o par (ou demais adultos) pedindo uma
 * ajudinha de valor X — sem cobrança, só combinado do casal.
 */
function coverageRequest(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);

  const body = http.requestBody(c);
  const amount = Number(body.amount_cents);
  if (!Number.isInteger(amount) || amount <= 0) {
    return http.fail(c, 400, "invalid_amount", "Informe um valor válido");
  }
  const note = String(body.note || "").slice(0, 200);

  let members = [];
  try {
    members = $app.findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: ctx.household }),
    );
  } catch (err) {
    members = [];
  }
  const targets = members.filter(
    (member) =>
      !http.isDeleted(member) &&
      member.getString("invite_status") !== "pending" &&
      member.getString("user") !== user.id &&
      member.getString("role") !== "viewer",
  );
  if (targets.length === 0) {
    return http.fail(c, 400, "no_partner", "Nenhum par disponível para receber o pedido");
  }

  const requester = String(user.getString("name") || user.getString("email") || "Seu par");
  let created = 0;
  for (const member of targets) {
    const delivery = new Record($app.findCollectionByNameOrId("notification_deliveries"));
    delivery.set("household", ctx.household);
    delivery.set("user", member.getString("user"));
    delivery.set("kind", "cobertura");
    delivery.set("entity", "coverage");
    delivery.set("entity_id", $security.randomString(15).toLowerCase());
    delivery.set("scheduled_date", new Date().toISOString());
    delivery.set("title", requester + " pediu uma cobertura");
    delivery.set("amount_cents", amount);
    delivery.set("note", note);
    delivery.set("status", "pendente");
    delivery.set("attempts", 0);
    $app.save(delivery);
    created += 1;
  }

  audit.writeAudit($app, {
    household: ctx.household,
    user: user.id,
    action: "notifications.coverage",
    entity: "notification_deliveries",
    entityId: user.id,
  });
  return http.ok(c, { ok: true, sent_to: created }, 202);
}

function listDeliveries(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const ctx = resolveContext(c, user);
  if (ctx.error) return http.fail(c, ctx.error.status, ctx.error.code, ctx.error.message);
  const rows = $app.findAllRecords(
    $app.findCollectionByNameOrId("notification_deliveries"),
    $dbx.hashExp({ household: ctx.household }),
  );
  rows.sort((a, b) => (a.getString("created") < b.getString("created") ? 1 : -1));
  return http.ok(c, {
    items: rows.slice(0, 100).map((row) => ({
      id: row.id,
      kind: row.getString("kind"),
      entity: row.getString("entity"),
      entity_id: row.getString("entity_id"),
      scheduled_date: row.get("scheduled_date"),
      status: row.getString("status"),
      sent_at: row.get("sent_at") || null,
    })),
  });
}

module.exports = {
  vapidPublicKey,
  getPreferences,
  updatePreferences,
  createSubscription,
  deleteSubscription,
  testNotification,
  coverageRequest,
  listDeliveries,
};
