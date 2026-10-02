function currentSeq(app) {
  try {
    const rows = app.db().newQuery("SELECT seq FROM change_log ORDER BY seq DESC LIMIT 1").all();
    if (!rows || rows.length === 0) return 0;
    return Number(rows[0].seq);
  } catch (err) {
    console.log("currentSeq error: " + String(err));
    return 0;
  }
}

function pullChanges(app, householdId, since, limit) {
  try {
    const rows = app.db().newQuery("SELECT seq, entity, entity_id FROM change_log ORDER BY seq ASC LIMIT 5").all();
    console.log("DBG len=" + (rows ? rows.length : "na") + " first=" + (rows && rows.length ? JSON.stringify(rows[0]) : "none"));
    const changes = [];
    for (let i = 0; i < rows.length; i += 1) {
      changes.push({ entity: String(rows[i].entity), id: String(rows[i].entity_id), seq: Number(rows[i].seq) });
    }
    return changes;
  } catch (err) {
    console.log("pullChanges error: " + String(err));
    return [];
  }
}

function writeChangeLog(app, householdId, entity, entityId, operation) {
  try {
    app.db().newQuery("INSERT INTO change_log (household_id, entity, entity_id, operation, changed_at) VALUES ({:household},{:entity},{:entityId},{:operation},{:changedAt})").bind({ household: householdId, entity: entity, entityId: entityId, operation: operation, changedAt: new Date().toISOString() }).execute();
  } catch (err) {
    console.log("change_log error: " + String(err));
  }
}

module.exports = { writeChangeLog, currentSeq, pullChanges };
