const http = require(`${__hooks}/lib/http.js`);
const auth = require(`${__hooks}/lib/auth.js`);
const audit = require(`${__hooks}/lib/audit.js`);
const permissions = require(`${__hooks}/lib/permissions.js`);
const shared = require(`${__hooks}/lib/shared.js`);

function seedCategories(householdId) {
  const collection = $app.findCollectionByNameOrId("categories");
  shared.CATEGORIES_SEED.forEach((item) => {
    const record = new Record(collection);
    record.set("household", householdId);
    record.set("name", item.name);
    record.set("kind", item.kind);
    record.set("group", item.group);
    record.set("color", item.color);
    record.set("icon", item.icon);
    record.set("system", true);
    record.set("active", true);
    record.set("order", item.order);
    $app.save(record);
  });
}

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
  if (!user) return http.fail(c, 401, "unauthorized", "Autenticação necessária");
  if (!user.getBool("active")) return http.fail(c, 403, "account_locked", "Conta bloqueada");

  const data = http.requestBody(c);
  const name = String(data.name || "").trim();
  if (!name || name.length > 80) return http.fail(c, 400, "invalid_name", "Nome inválido");

  const anyHousehold = $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ user: user.id }),
    )
    .filter((member) => !member.getString("deleted_at"));
  if (anyHousehold.length > 0) return http.fail(c, 409, "already_member", "Usuário já possui household");

  const household = new Record($app.findCollectionByNameOrId("households"));
  household.set("name", name);
  household.set("base_currency", "BRL");
  household.set("supported_currencies", ["BRL"]);
  household.set("settings", {});
  household.set("created_by", user.id);
  household.set("sync_id", $security.randomString(20));
  $app.save(household);

  const member = new Record($app.findCollectionByNameOrId("household_members"));
  member.set("household", household.id);
  member.set("user", user.id);
  member.set("role", "owner");
  member.set("invite_status", "accepted");
  member.set("permissions", {});
  member.set("joined_at", new Date().toISOString());
  member.set("sync_id", $security.randomString(20));
  $app.save(member);

  seedCategories(household.id);
  audit.writeAudit($app, { household: household.id, user: user.id, action: "household.create", entity: "households", entityId: household.id });

  return http.ok(
    c,
    {
      household: {
        id: household.id,
        name: household.getString("name"),
        base_currency: "BRL",
        created_by: user.id,
      },
    },
    201,
  );
}

function listMembers(c) {
  const user = http.authRecord(c);
  const householdId = http.pathParam(c, "id");
  const access = auth.membershipError(c, $app, user && user.id, householdId);
  if (access.status) return http.fail(c, access.status, access.code, access.message);
  const members = $app
    .findAllRecords(
      $app.findCollectionByNameOrId("household_members"),
      $dbx.hashExp({ household: householdId }),
    )
    .filter((member) => !member.getString("deleted_at"));
  return http.ok(c, {
    items: members.map((member) => ({
      id: member.id,
      household: member.getString("household"),
      user: member.getString("user"),
      role: member.getString("role"),
      invite_status: member.getString("invite_status") || "accepted",
      permissions: member.get("permissions") || {},
    })),
  });
}

function updateRole(c) {
  const user = http.authRecord(c);
  const householdId = http.pathParam(c, "id");
  const access = auth.membershipError(c, $app, user && user.id, householdId);
  if (access.status) return http.fail(c, access.status, access.code, access.message);
  if (!permissions.canManageMembers(access.role)) {
    return http.fail(c, 403, "forbidden", "Apenas o owner pode alterar papéis");
  }
  if (!auth.requireStepUp(c, user.id)) return http.fail(c, 403, "step_up_required", "Confirmação 2FA necessária");
  const data = http.requestBody(c);
  const role = String(data.role || "");
  if (["owner", "partner", "teen", "child", "viewer"].indexOf(role) === -1) {
    return http.fail(c, 400, "invalid_role", "Papel inválido");
  }
  let member;
  try {
    member = $app.findRecordById("household_members", http.pathParam(c, "memberId"));
  } catch (err) {
    return http.fail(c, 404, "not_found", "Membro não encontrado");
  }
  if (member.getString("household") !== householdId) {
    return http.fail(c, 403, "forbidden", "Membro de outro household");
  }
  const before = member.getString("role");
  if (permissions.isAdultRole(role) && !permissions.isAdultRole(before) && adultCount(householdId) >= 2) {
    return http.fail(c, 409, "adult_limit", "Limite de 2 adultos plenos atingido");
  }
  member.set("role", role);
  member.set("updated_by", user.id);
  $app.save(member);
  audit.writeAudit($app, {
    household: householdId,
    user: user.id,
    action: "member.role.update",
    entity: "household_members",
    entityId: member.id,
    before: { role: before },
    after: { role: role },
  });
  return http.ok(c, { member: { id: member.id, role: role } });
}

function removeMember(c) {
  const user = http.authRecord(c);
  const householdId = http.pathParam(c, "id");
  const access = auth.membershipError(c, $app, user && user.id, householdId);
  if (access.status) return http.fail(c, access.status, access.code, access.message);
  if (!permissions.canManageMembers(access.role)) {
    return http.fail(c, 403, "forbidden", "Apenas o owner pode remover membros");
  }
  if (!auth.requireStepUp(c, user.id)) return http.fail(c, 403, "step_up_required", "Confirmação 2FA necessária");
  let member;
  try {
    member = $app.findRecordById("household_members", http.pathParam(c, "memberId"));
  } catch (err) {
    return http.fail(c, 404, "not_found", "Membro não encontrado");
  }
  if (member.getString("household") !== householdId) {
    return http.fail(c, 403, "forbidden", "Membro de outro household");
  }
  if (member.getString("user") === user.id) {
    return http.fail(c, 409, "cannot_remove_self", "O owner não pode remover a si mesmo");
  }
  member.set("deleted_at", new Date().toISOString());
  member.set("updated_by", user.id);
  $app.save(member);
  audit.writeAudit($app, { household: householdId, user: user.id, action: "member.remove", entity: "household_members", entityId: member.id });
  return c.noContent(204);
}

module.exports = { create, listMembers, updateRole, removeMember };
