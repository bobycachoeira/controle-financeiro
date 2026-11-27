/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    if (!transactions.fields.getByName("exclude_from_reports")) {
      transactions.fields.add(new BoolField({ name: "exclude_from_reports" }));
      app.save(transactions);
    }
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const field = transactions.fields.getByName("exclude_from_reports");
    if (field) {
      transactions.fields.removeById(field.id);
      app.save(transactions);
    }
  },
);
