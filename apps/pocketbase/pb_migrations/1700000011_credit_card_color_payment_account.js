/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const accountsId = app.findCollectionByNameOrId("accounts").id;
    const cards = app.findCollectionByNameOrId("credit_cards");

    if (!cards.fields.getByName("color")) {
      cards.fields.add(new TextField({ name: "color", max: 32 }));
    }
    if (!cards.fields.getByName("payment_account")) {
      cards.fields.add(
        new RelationField({
          name: "payment_account",
          collectionId: accountsId,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      );
    }
    app.save(cards);
  },
  (app) => {
    /* no-op */
  },
);
