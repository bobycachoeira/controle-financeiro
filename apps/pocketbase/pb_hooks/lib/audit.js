function writeAudit(app, info) {
  try {
    const record = new Record(app.findCollectionByNameOrId("audit_logs"));
    if (info.household) record.set("household", info.household);
    if (info.user) record.set("user", info.user);
    record.set("action", info.action || "unknown");
    record.set("entity", info.entity || "");
    record.set("entity_id", info.entityId || "");
    record.set("before", info.before || {});
    record.set("after", info.after || {});
    record.set("ip", info.ip || "");
    record.set("user_agent", info.userAgent || "");
    app.save(record);
  } catch (err) {
    console.log("audit error: " + String(err));
  }
}

module.exports = { writeAudit };
