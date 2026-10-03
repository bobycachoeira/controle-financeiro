/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;

    function addSystemFields(collection) {
      collection.fields.add(new AutodateField({ name: "created", system: true, onCreate: true }));
      collection.fields.add(
        new AutodateField({ name: "updated", system: true, onCreate: true, onUpdate: true }),
      );
    }

    const subscriptions = new Collection({ type: "base", name: "push_subscriptions" });
    subscriptions.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    subscriptions.fields.add(
      new RelationField({ name: "user", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: true }),
    );
    subscriptions.fields.add(new TextField({ name: "endpoint", required: true, max: 1000 }));
    subscriptions.fields.add(new TextField({ name: "p256dh", required: true, max: 500 }));
    subscriptions.fields.add(new TextField({ name: "auth", required: true, max: 200 }));
    subscriptions.fields.add(new TextField({ name: "user_agent", max: 300 }));
    subscriptions.fields.add(new TextField({ name: "label", max: 80 }));
    subscriptions.fields.add(new DateField({ name: "last_seen_at" }));
    subscriptions.fields.add(new DateField({ name: "revoked_at" }));
    subscriptions.indexes = [
      "CREATE UNIQUE INDEX idx_push_endpoint ON push_subscriptions (endpoint)",
    ];
    addSystemFields(subscriptions);
    app.save(subscriptions);

    const preferences = new Collection({ type: "base", name: "notification_preferences" });
    preferences.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    preferences.fields.add(
      new RelationField({ name: "user", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: true }),
    );
    preferences.fields.add(new BoolField({ name: "push_enabled" }));
    preferences.fields.add(new JSONField({ name: "preferences", maxSize: 20000 }));
    preferences.indexes = [
      "CREATE UNIQUE INDEX idx_prefs_user_household ON notification_preferences (user, household)",
    ];
    addSystemFields(preferences);
    app.save(preferences);

    const deliveries = new Collection({ type: "base", name: "notification_deliveries" });
    deliveries.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    deliveries.fields.add(
      new RelationField({ name: "user", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: true }),
    );
    deliveries.fields.add(
      new SelectField({
        name: "kind",
        required: true,
        maxSelect: 1,
        values: ["contas_a_pagar", "contas_a_receber", "fatura_cartao", "fixas_recorrentes", "teste"],
      }),
    );
    deliveries.fields.add(new TextField({ name: "entity", required: true }));
    deliveries.fields.add(new TextField({ name: "entity_id" }));
    deliveries.fields.add(new DateField({ name: "scheduled_date" }));
    deliveries.fields.add(new DateField({ name: "due_date" }));
    deliveries.fields.add(new TextField({ name: "title" }));
    deliveries.fields.add(new NumberField({ name: "amount_cents", onlyInt: true }));
    deliveries.fields.add(
      new SelectField({
        name: "status",
        maxSelect: 1,
        values: ["pendente", "enviado", "falho", "descartado"],
      }),
    );
    deliveries.fields.add(new NumberField({ name: "attempts", onlyInt: true }));
    deliveries.fields.add(new TextField({ name: "last_error", max: 500 }));
    deliveries.fields.add(new DateField({ name: "sent_at" }));
    deliveries.indexes = [
      "CREATE UNIQUE INDEX idx_delivery_key ON notification_deliveries (user, kind, entity, entity_id, scheduled_date)",
    ];
    addSystemFields(deliveries);
    app.save(deliveries);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("notification_deliveries"));
    app.delete(app.findCollectionByNameOrId("notification_preferences"));
    app.delete(app.findCollectionByNameOrId("push_subscriptions"));
  },
);
