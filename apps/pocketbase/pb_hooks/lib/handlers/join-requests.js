const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const permissions = require(`${__hooks}/lib/permissions.js`);

const ROLES = ["owner", "partner", "teen", "child", "viewer"];

function userName(userId) {
  try {
    return $app.findRecordById("users", userId).getString("name");
  } catch (err) {
    return "";
  }
}

function userEmail(userId) {
  try {
    return $app.findRecordById("users", userId).email();
  } catch (err) {
    return "";
  }
}

function readSettings(household) {
  try {
    const raw = household.getString("settings");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function ensurePerson(household, member, personKey) {
  const settings = readSettings(household);
  const options = Array.isArray(settings.attribution_options) ? [...settings.attribution_options] : [];

  function labelFor(userId) {
    return userName(userId) || userEmail(userId) || userId;
  }

  function upsert(userId, key) {
    const byUser = options.find((item) => item && item.userId === userId);
    if (byUser) {
      byUser.userId = userId;
      if (key) byUser.key = key;
      if (!byUser.label) byUser.label = labelFor(userId);
      return;
    }
    const effectiveKey = key || userId;
    const byKey = options.find((item) => item && item.key === effectiveKey);
    if (byKey) {
      byKey.userId = userId;
      if (!byKey.label) byKey.label = labelFor(userId);
      return;
    }
    options.push({ key: effectiveKey, label: labelFor(userId), userId: userId });
  }

  // Todo membro aceito (inclui o owner) vira uma pessoa selecionável.
  $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: household.id }),
    )
    .filter(
      (m) => !m.getString("deleted_at") && m.getString("invite_status") !== "pending",
    )
    .forEach((m) => upsert(m.getString("user"), null));

  // Chave personalizada escolhida para o membro recém-aprovado.
  if (personKey) upsert(member.getString("user"), personKey);

  settings.attribution_options = options;
  household.set("settings", settings);
  $app.save(household);
}

function pendingMembers(householdId) {
  return $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: householdId }),
    )
    .filter(
      (member) =>
        !member.getString("deleted_at") && member.getString("invite_status") === "pending",
    );
}

function adultCount(householdId, excludeMemberId) {
  return $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: householdId }),
    )
    .filter(
      (member) =>
        member.id !== excludeMemberId &&
        !member.getString("deleted_at") &&
        member.getString("invite_status") !== "pending" &&
        (member.getString("role") === "owner" || member.getString("role") === "partner"),
    ).length;
}

function guard(c, householdId) {
  const user = http.authRecord(c);
  const access = auth.membershipError(c, $app, user && user.id, householdId);
  if (access.status) return { error: access };
  if (!permissions.canManageMembers(access.role)) {
    return { error: { status: 403, code: "forbidden", message: "Apenas o owner pode gerenciar solicitações" } };
  }
  return { user: user };
}

function list(c) {
  const householdId = http.pathParam(c, "id");
  const g = guard(c, householdId);
  if (g.error) return http.fail(c, g.error.status, g.error.code, g.error.message);
  return http.ok(c, {
    items: pendingMembers(householdId).map((member) => ({
      id: member.id,
      user: member.getString("user"),
      user_name: userName(member.getString("user")),
      email: userEmail(member.getString("user")),
      role_suggested: member.getString("role"),
      created: member.getString("created") || null,
    })),
  });
}

function approve(c) {
  const householdId = http.pathParam(c, "id");
  const g = guard(c, householdId);
  if (g.error) return http.fail(c, g.error.status, g.error.code, g.error.message);
  if (!auth.requireStepUp(c, g.user.id)) {
    return http.fail(c, 403, "step_up_required", "Confirmação 2FA necessária");
  }

  const memberId = http.pathParam(c, "memberId");
  let member;
  try {
    member = $app.findRecordById("household_members", memberId);
  } catch (err) {
    return http.fail(c, 404, "not_found", "Solicitação não encontrada");
  }
  if (member.getString("household") !== householdId) {
    return http.fail(c, 403, "forbidden", "Solicitação de outro household");
  }

  const data = http.requestBody(c);
  const role = String(data.role || member.getString("role") || "child");
  if (ROLES.indexOf(role) === -1) return http.fail(c, 400, "invalid_role", "Papel inválido");
  if ((role === "owner" || role === "partner") && adultCount(householdId, member.id) >= 2) {
    return http.fail(c, 409, "adult_limit", "Limite de 2 adultos plenos atingido");
  }

  member.set("role", role);
  member.set("invite_status", "accepted");
  member.set("joined_at", new Date().toISOString());
  $app.save(member);

  let household = null;
  try {
    household = $app.findRecordById("households", householdId);
  } catch (err) {
    household = null;
  }
  if (household && data.person_key !== undefined) {
    ensurePerson(household, member, data.person_key ? String(data.person_key) : null);
  } else if (household) {
    ensurePerson(household, member, null);
  }

  audit.writeAudit($app, {
    household: householdId,
    user: g.user.id,
    action: "member.approve",
    entity: "household_members",
    entityId: member.id,
    after: { role: role },
  });

  return http.ok(c, {
    member: {
      id: member.id,
      household: householdId,
      user: member.getString("user"),
      role: role,
      invite_status: "accepted",
    },
  });
}

function reject(c) {
  const householdId = http.pathParam(c, "id");
  const g = guard(c, householdId);
  if (g.error) return http.fail(c, g.error.status, g.error.code, g.error.message);
  let member;
  try {
    member = $app.findRecordById("household_members", http.pathParam(c, "memberId"));
  } catch (err) {
    return http.fail(c, 404, "not_found", "Solicitação não encontrada");
  }
  if (member.getString("household") !== householdId) {
    return http.fail(c, 403, "forbidden", "Solicitação de outro household");
  }
  member.set("deleted_at", new Date().toISOString());
  $app.save(member);
  audit.writeAudit($app, {
    household: householdId,
    user: g.user.id,
    action: "member.reject",
    entity: "household_members",
    entityId: member.id,
  });
  return c.noContent(204);
}

module.exports = { list, approve, reject };
