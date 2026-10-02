/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;

    const syncEvents = new Collection({ type: "base", name: "sync_events" });
    syncEvents.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    syncEvents.fields.add(
      new RelationField({ name: "user", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    syncEvents.fields.add(new TextField({ name: "entity", required: true }));
    syncEvents.fields.add(new TextField({ name: "entity_id" }));
    syncEvents.fields.add(new TextField({ name: "sync_id", required: true }));
    syncEvents.fields.add(
      new SelectField({ name: "operation", required: true, maxSelect: 1, values: ["create", "update", "delete"] }),
    );
    syncEvents.fields.add(new DateField({ name: "client_ts" }));
    syncEvents.fields.add(new DateField({ name: "server_ts" }));
    syncEvents.fields.add(
      new SelectField({ name: "result", maxSelect: 1, values: ["applied", "conflict", "ignored", "error"] }),
    );
    syncEvents.fields.add(new JSONField({ name: "detail", maxSize: 20000 }));
    syncEvents.indexes = [
      "CREATE UNIQUE INDEX idx_sync_events_scope ON sync_events (household, entity, sync_id)",
    ];
    app.save(syncEvents);

    const auditLogs = new Collection({ type: "base", name: "audit_logs" });
    auditLogs.fields.add(
      new RelationField({ name: "household", collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    auditLogs.fields.add(
      new RelationField({ name: "user", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    auditLogs.fields.add(new TextField({ name: "action", required: true }));
    auditLogs.fields.add(new TextField({ name: "entity" }));
    auditLogs.fields.add(new TextField({ name: "entity_id" }));
    auditLogs.fields.add(new JSONField({ name: "before", maxSize: 20000 }));
    auditLogs.fields.add(new JSONField({ name: "after", maxSize: 20000 }));
    auditLogs.fields.add(new TextField({ name: "ip" }));
    auditLogs.fields.add(new TextField({ name: "user_agent" }));
    app.save(auditLogs);

    const trustedDevices = new Collection({ type: "base", name: "trusted_devices" });
    trustedDevices.fields.add(
      new RelationField({ name: "user", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: true }),
    );
    trustedDevices.fields.add(new TextField({ name: "label", required: true, max: 80 }));
    trustedDevices.fields.add(new TextField({ name: "token_hash", required: true }));
    trustedDevices.fields.add(new TextField({ name: "user_agent" }));
    trustedDevices.fields.add(new TextField({ name: "ip" }));
    trustedDevices.fields.add(new DateField({ name: "last_seen_at" }));
    trustedDevices.fields.add(new DateField({ name: "expires_at", required: true }));
    trustedDevices.fields.add(new DateField({ name: "revoked_at" }));
    app.save(trustedDevices);

    app
      .db()
      .newQuery(
        "CREATE TABLE IF NOT EXISTS change_log (" +
          "seq INTEGER PRIMARY KEY AUTOINCREMENT, " +
          "household_id TEXT NOT NULL, " +
          "entity TEXT NOT NULL, " +
          "entity_id TEXT NOT NULL, " +
          "operation TEXT NOT NULL, " +
          "changed_at TEXT NOT NULL)",
      )
      .execute();
  },
  (app) => {
    app.db().newQuery("DROP TABLE IF EXISTS change_log").execute();
    app.delete(app.findCollectionByNameOrId("trusted_devices"));
    app.delete(app.findCollectionByNameOrId("audit_logs"));
    app.delete(app.findCollectionByNameOrId("sync_events"));
  },
);
