const http = require(`${__hooks}/lib/http.js`);
const audit = require(`${__hooks}/lib/audit.js`);

function readCredentials(user) {
  try {
    const raw = user.getString("webauthn_credentials");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveCredentials(app, user, list) {
  user.set("webauthn_credentials", list);
  app.save(user);
}

function list(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  return http.ok(c, {
    items: readCredentials(user).map((item) => ({
      id: item.id,
      label: item.label || "Passkey",
      created_at: item.created_at || null,
    })),
  });
}

function register(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const data = http.requestBody(c);
  const id = String(data.id || "");
  if (!id) return http.fail(c, 400, "invalid_credential", "Credencial inválida");
  const list = readCredentials(user);
  if (list.some((item) => item.id === id)) {
    return http.fail(c, 409, "already_registered", "Passkey já cadastrada");
  }
  const entry = {
    id: id,
    label: String(data.label || "Dispositivo").slice(0, 80),
    public_key: data.public_key ? String(data.public_key) : "",
    created_at: new Date().toISOString(),
  };
  list.push(entry);
  saveCredentials($app, user, list);
  audit.writeAudit($app, { user: user.id, action: "passkey.register", entity: "users", entityId: user.id });
  return http.ok(c, { id: entry.id, label: entry.label, created_at: entry.created_at }, 201);
}

function remove(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const id = http.pathParam(c, "id");
  const list = readCredentials(user);
  const next = list.filter((item) => item.id !== id);
  if (next.length === list.length) return http.fail(c, 404, "not_found", "Passkey não encontrada");
  saveCredentials($app, user, next);
  audit.writeAudit($app, { user: user.id, action: "passkey.revoke", entity: "users", entityId: user.id });
  return c.noContent(204);
}

module.exports = { list, register, remove };
