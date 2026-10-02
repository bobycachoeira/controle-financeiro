const ADULT_ROLES = ["owner", "partner"];

function canReadAll(role) {
  return role !== "child";
}

function canManageFinance(role) {
  return role === "owner" || role === "partner";
}

function canWriteTransactions(role, isOwn) {
  if (role === "owner" || role === "partner") return true;
  if (role === "teen" || role === "child") return Boolean(isOwn);
  return false;
}

function canInvite(role) {
  return role === "owner" || role === "partner";
}

function canManageMembers(role) {
  return role === "owner";
}

function canManageSecurity(role) {
  return role === "owner";
}

function canManageBatch(role) {
  return role === "owner" || role === "partner";
}

function isAdultRole(role) {
  return ADULT_ROLES.indexOf(role) !== -1;
}

module.exports = {
  canReadAll,
  canManageFinance,
  canWriteTransactions,
  canInvite,
  canManageMembers,
  canManageSecurity,
  canManageBatch,
  isAdultRole,
};
