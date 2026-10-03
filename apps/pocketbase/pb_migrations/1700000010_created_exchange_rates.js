/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;

    const transactions = app.findCollectionByNameOrId("transactions");
    if (!transactions.fields.getByName("origin")) {
      transactions.fields.add(
        new SelectField({ name: "origin", maxSelect: 1, values: ["manual", "import", "recurrence"] }),
      );
    }
    if (!transactions.fields.getByName("external_ref")) {
      transactions.fields.add(new TextField({ name: "external_ref", max: 200 }));
    }
    app.save(transactions);

    const rates = new Collection({ type: "base", name: "exchange_rates" });
    rates.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    rates.fields.add(new TextField({ name: "currency", required: true, max: 8 }));
    rates.fields.add(new DateField({ name: "date", required: true }));
    rates.fields.add(new NumberField({ name: "rate_micros", required: true, onlyInt: true, min: 1 }));
    rates.fields.add(new TextField({ name: "sync_id" }));
    rates.fields.add(
      new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    rates.fields.add(new DateField({ name: "deleted_at" }));
    rates.fields.add(new AutodateField({ name: "created", system: true, onCreate: true }));
    rates.fields.add(new AutodateField({ name: "updated", system: true, onCreate: true, onUpdate: true }));
    rates.indexes = [
      "CREATE UNIQUE INDEX idx_rates_scope ON exchange_rates (household, currency, date)",
    ];
    app.save(rates);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("exchange_rates"));
  },
);
