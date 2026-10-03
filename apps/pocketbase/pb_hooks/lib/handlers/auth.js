const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const magic = require(`${__hooks}/lib/magic-link.js`);
const mailer = require(`${__hooks}/lib/mailer.js`);
const totp = require(`${__hooks}/lib/totp.js`);
const recovery = require(`${__hooks}/lib/recovery.js`);
const crypto = require(`${__hooks}/lib/crypto.js`);
const stepup = require(`${__hooks}/lib/stepup.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const ratelimit = require(`${__hooks}/lib/ratelimit.js`);
const security = require(`${__hooks}/lib/security-response.js`);

function userName(userId) {
  try {
    return $app.findRecordById("users", userId).getString("name");
  } catch (err) {
    return "";
  }
}

function householdName(householdId) {
  try {
    return $app.findRecordById("households", householdId).getString("name");
  } catch (err) {
    return "";
  }
}

function memberSummary(member) {
  return {
    id: member.id,
    household: member.getString("household"),
    user: member.getString("user"),
    user_name: userName(member.getString("user")),
    role: member.getString("role"),
    invite_status: member.getString("invite_status") || "accepted",
    permissions: member.get("permissions") || {},
  };
}

function buildAuthResult(user, options) {
  const opts = options || {};
  const authToken = user.newAuthToken();
  let refreshValue = authToken;
  try {
    refreshValue = user.newRefreshToken();
  } catch (err) {
    refreshValue = authToken;
  }
  const result = {
    token: authToken,
    refresh_token: refreshValue,
    step_up_required: Boolean(opts.stepUpRequired),
    trusted_device: Boolean(opts.trustedDevice),
  };
  if (opts.stepUpToken) result.step_up_token = opts.stepUpToken;
  return result;
}

function magicLinkRequest(c) {
  const data = http.requestBody(c);
  const email = String(data.email || "").toLowerCase();
  const limit = ratelimit.rateLimit("magic:" + email, 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return c.json(
      429,
      { error: { code: "rate_limited", message: "Muitas tentativas" } },
      { "Retry-After": String(limit.retryAfter) },
    );
  }
  if (email) {
    try {
      const user = $app.findAuthRecordByEmail("users", email);
      const issued = magic.issueMagicToken($app, user);
      mailer.sendMagicLink($app, email, issued.token);
    } catch (err) {
      // não revelar existência do e-mail
    }
  }
  audit.writeAudit($app, { action: "auth.magic_link.request", entity: "users", ip: http.clientIp(c) });
  return http.ok(c, { ok: true }, 202);
}

function magicLinkVerify(c) {
  const data = http.requestBody(c);
  const token = String(data.token || "");
  const deviceLabel = String(data.device_label || "").slice(0, 80);
  const user = magic.findUserByToken($app, token);
  if (!user) return http.fail(c, 410, "token_invalid", "Link inválido, expirado ou já usado");
  const expires = user.get("magic_token_expires");
  if (!expires || new Date(expires).getTime() < Date.now()) {
    return http.fail(c, 410, "token_expired", "Link expirado");
  }
  if (!user.getBool("active")) return http.fail(c, 403, "account_locked", "Conta bloqueada");
  magic.consumeToken($app, user);
  user.set("last_login_at", new Date().toISOString());
  user.set("last_known_device", deviceLabel);
  $app.save(user);

  const requires2fa = user.getBool("twofa_enabled");
  http.log("auth.login", { userId: user.id, requires2fa: requires2fa });
  audit.writeAudit($app, {
    user: user.id,
    action: "auth.login",
    entity: "users",
    entityId: user.id,
    ip: http.clientIp(c),
    userAgent: http.clientUserAgent(c),
  });
  return http.ok(c, buildAuthResult(user, { stepUpRequired: requires2fa, trustedDevice: false }));
}

function refresh(c) {
  const data = http.requestBody(c);
  const refreshToken = String(data.refresh_token || "");
  let user = null;
  try {
    user = $app.findAuthRecordByToken(refreshToken, "auth");
  } catch (err) {
    user = null;
  }
  if (!user) return http.fail(c, 401, "invalid_refresh", "Refresh token inválido");
  return http.ok(c, buildAuthResult(user, { stepUpRequired: user.getBool("twofa_enabled") }));
}

function me(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const memberships = $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ user: user.id }),
    )
    .filter((member) => !http.isDeleted(member));
  const allMembers = $app
    .findAllRecords($app.findCollectionByNameOrId("household_members"))
    .filter((member) => !http.isDeleted(member));
  return http.ok(c, {
    user: { id: user.id, email: user.email(), name: user.getString("name"), active: user.getBool("active") },
    memberships: memberships.map((member) => ({
      id: member.id,
      household: member.getString("household"),
      user: member.getString("user"),
      role: member.getString("role"),
      invite_status: member.getString("invite_status") || "accepted",
      permissions: member.get("permissions") || {},
      household_name: householdName(member.getString("household")),
    })),
    members: allMembers
      .filter((member) => member.getString("household") === (memberships[0]?.getString("household") ?? ""))
      .map((member) => memberSummary(member)),
    twofa_enabled: user.getBool("twofa_enabled"),
  });
}

function logout(c) {
  const user = http.authRecord(c);
  if (user) {
    audit.writeAudit($app, { user: user.id, action: "auth.logout", entity: "users", entityId: user.id });
  }
  return c.noContent(204);
}

function twofaSetup(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const secret = totp.generateSecret(20);
  user.set("twofa_secret_encrypted", crypto.encryptSecret(secret));
  user.set("twofa_setup_completed", false);
  $app.save(user);
  return http.ok(c, { otpauth_uri: totp.otpauthUri(secret, user.email()), secret: secret });
}

function twofaConfirm(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const data = http.requestBody(c);
  const secret = crypto.decryptSecret(user.getString("twofa_secret_encrypted"));
  if (!secret || !totp.verifyTotp(secret, String(data.code || ""), 1)) {
    return http.fail(c, 400, "invalid_code", "Código inválido");
  }
  const codes = recovery.generateRecoveryCodes(10);
  user.set("recovery_codes_hashed", recovery.hashCodes(codes));
  user.set("twofa_enabled", true);
  user.set("twofa_setup_completed", true);
  $app.save(user);
  audit.writeAudit($app, { user: user.id, action: "2fa.enabled", entity: "users", entityId: user.id });
  return http.ok(c, { recovery_codes: codes });
}

function twofaVerify(c) {
  const data = http.requestBody(c);
  const sessionToken = String(data.session_token || "");
  let user = null;
  try {
    user = $app.findAuthRecordByToken(sessionToken, "auth");
  } catch (err) {
    user = null;
  }
  if (!user) return http.fail(c, 401, "invalid_session", "Sessão inválida");

  const limit = security.recordFailure("2fa", user.id);
  if (!limit.allowed) {
    security.lockAccount($app, user, "too_many_2fa_failures");
    return c.json(
      429,
      { error: { code: "locked", message: "Conta bloqueada por segurança" } },
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  const kind = data.kind === "recovery" ? "recovery" : "totp";
  let valid = false;
  if (kind === "recovery") {
    const hashed = user.get("recovery_codes_hashed") || [];
    const index = recovery.matchCode(hashed, String(data.code || ""));
    if (index >= 0) {
      hashed.splice(index, 1);
      user.set("recovery_codes_hashed", hashed);
      $app.save(user);
      valid = true;
    }
  } else {
    const secret = crypto.decryptSecret(user.getString("twofa_secret_encrypted"));
    valid = Boolean(secret) && totp.verifyTotp(secret, String(data.code || ""), 1);
  }

  if (!valid) return http.fail(c, 401, "invalid_code", "Código inválido");
  security.clearFailures("2fa", user.id);
  const issued = stepup.issueStepUp($app, user.id);
  audit.writeAudit($app, {
    user: user.id,
    action: "2fa.verified",
    entity: "users",
    entityId: user.id,
    ip: http.clientIp(c),
  });
  return http.ok(
    c,
    buildAuthResult(user, {
      stepUpRequired: false,
      stepUpToken: issued.token,
      trustedDevice: Boolean(data.remember_device),
    }),
  );
}

function twofaDisable(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  if (user.getBool("twofa_enabled") && !auth.requireStepUp(c, user.id)) {
    return http.fail(c, 403, "step_up_required", "Confirmação 2FA necessária");
  }
  user.set("twofa_enabled", false);
  user.set("twofa_setup_completed", false);
  user.set("recovery_codes_hashed", []);
  $app.save(user);
  audit.writeAudit($app, { user: user.id, action: "2fa.disabled", entity: "users", entityId: user.id });
  return c.noContent(204);
}

module.exports = {
  magicLinkRequest,
  magicLinkVerify,
  refresh,
  me,
  logout,
  twofaSetup,
  twofaConfirm,
  twofaVerify,
  twofaDisable,
};
