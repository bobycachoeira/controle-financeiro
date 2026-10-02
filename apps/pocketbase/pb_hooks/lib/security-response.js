const ratelimit = require(`${__hooks}/lib/ratelimit.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const mailer = require(`${__hooks}/lib/mailer.js`);

function recordFailure(scope, identifier) {
  return ratelimit.rateLimit(scope + ":" + identifier, 5, 15 * 60 * 1000);
}

function clearFailures(scope, identifier) {
  ratelimit.reset(scope + ":" + identifier);
}

function lockAccount(app, user, reason) {
  user.set("active", false);
  app.save(user);

  console.log(JSON.stringify({ ts: new Date().toISOString(), event: "security.lockout", userId: user.id, reason: reason }));

  try {
    const devices = app.findAllRecords(
      app.findCollectionByNameOrId("trusted_devices"),
      $dbx.exp("user = {:user} AND revoked_at = NULL", { user: user.id }),
    );
    for (const device of devices) {
      device.set("revoked_at", new Date().toISOString());
      app.save(device);
    }
  } catch (err) {
    console.log("lockAccount devices error: " + String(err));
  }

  audit.writeAudit(app, {
    user: user.id,
    action: "security.lockout",
    entity: "users",
    entityId: user.id,
    after: { reason: reason },
  });

  mailer.sendSecurityAlert(
    app,
    user.email(),
    "Acesso bloqueado por segurança",
    "Detectamos tentativas repetidas de verificação. A conta foi bloqueada temporariamente.",
  );
}

module.exports = { recordFailure, clearFailures, lockAccount };
