function isSystem(record) {
  return Boolean(record.get("system"));
}

function canDelete(record) {
  return !isSystem(record);
}

module.exports = { isSystem, canDelete };
