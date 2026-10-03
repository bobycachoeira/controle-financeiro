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

    function addSyncFields(collection) {
      collection.fields.add(new TextField({ name: "sync_id" }));
      collection.fields.add(
        new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
      );
      collection.fields.add(new DateField({ name: "deleted_at" }));
    }

    const recurrences = new Collection({ type: "base", name: "recurrences" });
    recurrences.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    recurrences.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    recurrences.fields.add(new TextField({ name: "rrule", required: true, max: 500 }));
    recurrences.fields.add(new TextField({ name: "timezone", max: 60 }));
    recurrences.fields.add(new DateField({ name: "start_date", required: true }));
    recurrences.fields.add(new DateField({ name: "end_date" }));
    recurrences.fields.add(new NumberField({ name: "count", onlyInt: true, min: 1 }));
    recurrences.fields.add(new BoolField({ name: "active" }));
    recurrences.fields.add(new DateField({ name: "last_run" }));
    recurrences.fields.add(new DateField({ name: "next_run" }));
    recurrences.fields.add(
      new SelectField({ name: "target", maxSelect: 1, values: ["transaction", "bill"] }),
    );
    recurrences.fields.add(
      new SelectField({ name: "creates_status", maxSelect: 1, values: ["pago", "a_pagar"] }),
    );
    recurrences.fields.add(new JSONField({ name: "template", maxSize: 20000 }));
    addSyncFields(recurrences);
    addSystemFields(recurrences);
    app.save(recurrences);

    const budgets = new Collection({ type: "base", name: "budgets" });
    budgets.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    budgets.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    budgets.fields.add(
      new SelectField({ name: "period", maxSelect: 1, values: ["mensal", "trimestral", "anual"] }),
    );
    budgets.fields.add(new TextField({ name: "currency", max: 8 }));
    budgets.fields.add(new NumberField({ name: "total_cents", required: true, onlyInt: true, min: 1 }));
    budgets.fields.add(new NumberField({ name: "alert_pct", onlyInt: true, min: 1, max: 100 }));
    budgets.fields.add(new BoolField({ name: "active" }));
    budgets.fields.add(new TextField({ name: "reference_month", required: true, max: 7 }));
    budgets.fields.add(new JSONField({ name: "categories", maxSize: 20000 }));
    addSyncFields(budgets);
    addSystemFields(budgets);
    app.save(budgets);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("budgets"));
    app.delete(app.findCollectionByNameOrId("recurrences"));
  },
);
