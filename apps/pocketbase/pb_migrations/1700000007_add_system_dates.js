/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const names = [
      "households",
      "household_members",
      "invites",
      "accounts",
      "credit_cards",
      "categories",
      "transactions",
      "installments",
      "invoices",
      "transfers",
      "bills",
      "sync_events",
      "audit_logs",
      "trusted_devices",
    ];

    for (const name of names) {
      const collection = app.findCollectionByNameOrId(name);
      if (!collection.fields.getByName("created")) {
        collection.fields.add(new AutodateField({ name: "created", system: true, onCreate: true }));
      }
      if (!collection.fields.getByName("updated")) {
        collection.fields.add(
          new AutodateField({ name: "updated", system: true, onCreate: true, onUpdate: true }),
        );
      }
      app.save(collection);
    }
  },
  (app) => {
    /* no-op */
  },
);
