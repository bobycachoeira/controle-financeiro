/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const cards = app.findCollectionByNameOrId("credit_cards");
    if (!cards.fields.getByName("order")) {
      cards.fields.add(new NumberField({ name: "order", onlyInt: true }));
    }
    app.save(cards);
  },
  (app) => {
    /* no-op */
  },
);
