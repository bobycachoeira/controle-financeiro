/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const cards = app.findCollectionByNameOrId("credit_cards");
    if (!cards.fields.getByName("owner")) {
      cards.fields.add(new TextField({ name: "owner", max: 60 }));
    }
    app.save(cards);
  },
  (app) => {
    /* no-op */
  },
);
