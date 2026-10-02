const http = require(`${__hooks}/lib/http.js`);
const audit = require(`${__hooks}/lib/audit.js`);

function list(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const devices = $app
    .findAllRecords(
      $app.findCollectionByNameOrId("trusted_devices"),
      $dbx.hashExp({ user: user.id }),
    )
    .filter((device) => !device.getString("revoked_at"));
  return http.ok(c, {
    items: devices.map((device) => ({
      id: device.id,
      label: device.getString("label"),
      last_seen_at: device.get("last_seen_at") || null,
      expires_at: device.get("expires_at") || null,
      revoked_at: device.get("revoked_at") || null,
    })),
  });
}

function create(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const data = http.requestBody(c);
  const token = $security.randomString(48);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const record = new Record($app.findCollectionByNameOrId("trusted_devices"));
  record.set("user", user.id);
  record.set(
    "label",
    String(data.label || user.getString("last_known_device") || "Dispositivo").slice(0, 80),
  );
  record.set("token_hash", $security.sha256(token));
  record.set("user_agent", http.clientUserAgent(c));
  record.set("ip", http.clientIp(c));
  record.set("last_seen_at", new Date().toISOString());
  record.set("expires_at", expires.toISOString());
  $app.save(record);
  audit.writeAudit($app, { user: user.id, action: "device.trust", entity: "trusted_devices", entityId: record.id });
  return http.ok(
    c,
    {
      id: record.id,
      label: record.getString("label"),
      last_seen_at: record.get("last_seen_at"),
      expires_at: record.get("expires_at"),
      revoked_at: null,
      device_token: token,
    },
    201,
  );
}

function remove(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const id = http.pathParam(c, "id");
  let record;
  try {
    record = $app.findRecordById("trusted_devices", id);
  } catch (err) {
    return http.fail(c, 404, "not_found", "Dispositivo não encontrado");
  }
  if (record.getString("user") !== user.id) {
    return http.fail(c, 403, "forbidden", "Dispositivo de outro usuário");
  }
  record.set("revoked_at", new Date().toISOString());
  $app.save(record);
  audit.writeAudit($app, { user: user.id, action: "device.revoke", entity: "trusted_devices", entityId: id });
  return c.noContent(204);
}

module.exports = { list, create, remove };
