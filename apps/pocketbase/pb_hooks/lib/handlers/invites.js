const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const permissions = require(`${__hooks}/lib/permissions.js`);
const mailer = require(`${__hooks}/lib/mailer.js`);
const ratelimit = require(`${__hooks}/lib/ratelimit.js`);

function adultCount(householdId) {
  return $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: householdId }),
    )
    .filter(
      (member) =>
        !member.getString("deleted_at") &&
        (member.getString("role") === "owner" || member.getString("role") === "partner"),
    ).length;
}

function create(c) {
  const user = http.authRecord(c);
  const householdId = http.pathParam(c, "id");
  const access = auth.membershipError(c, $app, user && user.id, householdId);
  if (access.status) return http.fail(c, access.status, access.code, access.message);
  if (!permissions.canInvite(access.role)) return http.fail(c, 403, "forbidden", "Sem permissão para convidar");
  if (!auth.requireStepUp(c, user.id)) return http.fail(c, 403, "step_up_required", "Confirmação 2FA necessária");
  const limit = ratelimit.rateLimit("invite:" + householdId, 10, 24 * 60 * 60 * 1000);
  if (!limit.allowed) return http.fail(c, 429, "rate_limited", "Muitos convites hoje");

  const data = http.requestBody(c);
  const email = String(data.email_invited || "").toLowerCase();
  const role = String(data.role || "partner");
  if (["partner", "teen", "child", "viewer"].indexOf(role) === -1) {
    return http.fail(c, 400, "invalid_role", "Papel inválido");
  }
  if (email.indexOf("@") === -1) return http.fail(c, 400, "invalid_email", "E-mail inválido");
  if (role === "partner" && adultCount(householdId) >= 2) {
    return http.fail(c, 409, "adult_limit", "Limite de 2 adultos plenos atingido");
  }

  const token = $security.randomString(48);
  const expires = new Date(Date.now() + 25 * 60 * 1000);
  const invite = new Record($app.findCollectionByNameOrId("invites"));
  invite.set("household", householdId);
  invite.set("role", role);
  invite.set("email_invited", email);
  invite.set("token_hash", $security.sha256(token));
  invite.set("expires_at", expires.toISOString());
  invite.set("max_uses", 1);
  invite.set("single_use", true);
  invite.set("created_by", user.id);
  $app.save(invite);

  mailer.sendSecurityAlert($app, email, "Convite para a família", "Você foi convidado. Código do convite: " + token);
  audit.writeAudit($app, {
    household: householdId,
    user: user.id,
    action: "invite.create",
    entity: "invites",
    entityId: invite.id,
    after: { email: email, role: role },
  });

  return http.ok(
    c,
    {
      invite: {
        id: invite.id,
        role: role,
        email_invited: email,
        expires_at: invite.get("expires_at"),
        token: token,
      },
    },
    201,
  );
}

function accept(c) {
  const user = http.authRecord(c);
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  const token = http.pathParam(c, "token");
  const hash = $security.sha256(token);
  let invite;
  try {
    invite = $app.findFirstRecordByFilter("invites", "token_hash = {:hash}", { hash: hash });
  } catch (err) {
    return http.fail(c, 410, "invite_invalid", "Convite inválido ou expirado");
  }
  if (!invite) return http.fail(c, 410, "invite_invalid", "Convite inválido ou expirado");
  if (invite.getString("used_at")) return http.fail(c, 410, "invite_used", "Convite já utilizado");
  const expires = invite.get("expires_at");
  if (!expires || new Date(expires).getTime() < Date.now()) {
    return http.fail(c, 410, "invite_expired", "Convite expirado");
  }

  const householdId = invite.getString("household");
  const role = invite.getString("role");
  if (role === "partner" && adultCount(householdId) >= 2) {
    return http.fail(c, 409, "adult_limit", "Limite de 2 adultos plenos atingido");
  }

  let member = null;
  try {
    member = $app.findFirstRecordByFilter(
      "household_members",
      "household = {:household} && user = {:user}",
      { household: householdId, user: user.id },
    );
  } catch (err) {
    member = null;
  }
  if (member) {
    member.set("role", role);
    member.set("deleted_at", null);
    member.set("invite_status", "accepted");
    $app.save(member);
  } else {
    member = new Record($app.findCollectionByNameOrId("household_members"));
    member.set("household", householdId);
    member.set("user", user.id);
    member.set("role", role);
    member.set("invite_status", "accepted");
    member.set("permissions", {});
    member.set("joined_at", new Date().toISOString());
    member.set("sync_id", $security.randomString(20));
    $app.save(member);
  }

  invite.set("used_at", new Date().toISOString());
  invite.set("used_by", user.id);
  $app.save(invite);

  audit.writeAudit($app, { household: householdId, user: user.id, action: "invite.accept", entity: "household_members", entityId: member.id });

  return http.ok(c, {
    member: {
      id: member.id,
      household: householdId,
      user: user.id,
      role: role,
      invite_status: "accepted",
      permissions: member.get("permissions") || {},
    },
  });
}

module.exports = { create, accept };
