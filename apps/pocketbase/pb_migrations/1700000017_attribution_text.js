/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const targets = [
      { collection: "transactions", field: "attribution" },
      { collection: "bills", field: "attribution" },
      { collection: "accounts", field: "owner" },
    ];
    for (const target of targets) {
      const collection = app.findCollectionByNameOrId(target.collection);
      if (collection.fields.getByName(target.field)) {
        collection.fields.removeByName(target.field);
      }
      collection.fields.add(new TextField({ name: target.field, max: 60 }));
      app.save(collection);
    }
  },
  (app) => {
    /* no-op */
  },
);
