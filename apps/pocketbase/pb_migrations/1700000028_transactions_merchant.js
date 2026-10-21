/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    if (!transactions.fields.getByName("merchant")) {
      transactions.fields.add(new TextField({ name: "merchant", max: 120 }));
      app.save(transactions);
    }
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const merchant = transactions.fields.getByName("merchant");
    if (merchant) {
      transactions.fields.removeById(merchant.id);
      app.save(transactions);
    }
  },
);
