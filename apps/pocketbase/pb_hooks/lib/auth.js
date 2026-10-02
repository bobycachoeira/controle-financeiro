const stepup = require(`${__hooks}/lib/stepup.js`);
const permissions = require(`${__hooks}/lib/permissions.js`);
const http = require(`${__hooks}/lib/http.js`);

function findMembership(app, userId, householdId) {
  if (!userId || !householdId) return null;
  try {
    const member = app.findFirstRecordByFilter(
      "household_members",
      "household = {:household} && user = {:user}",
      { household: householdId, user: userId },
    );
    if (!member || http.isDeleted(member)) return null;
    return member;
  } catch (err) {
    return null;
  }
}

function membershipError(c, app, userId, householdId) {
  if (!userId) {
    return { status: 401, code: "unauthorized", message: "Autenticação necessária" };
  }
  const member = findMembership(app, userId, householdId);
  if (!member) {
    return { status: 403, code: "forbidden", message: "Sem acesso ao household" };
  }
  return { member: member, role: member.getString("role") };
}

function requireStepUp(c, userId) {
  let token = "";
  try {
    token = c.request.header.get("X-Step-Up-Token") || "";
  } catch (err) {
    token = "";
  }
  return stepup.verifyStepUp(token, userId);
}

function hasPermissionError(role, capability) {
  const allowed = permissions[capability] ? permissions[capability](role) : false;
  if (allowed) return null;
  return { status: 403, code: "forbidden", message: "Permissão insuficiente" };
}

module.exports = {
  findMembership,
  membershipError,
  requireStepUp,
  hasPermissionError,
};
