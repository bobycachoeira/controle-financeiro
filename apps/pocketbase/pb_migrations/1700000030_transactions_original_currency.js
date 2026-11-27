/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    if (!transactions.fields.getByName("original_currency")) {
      transactions.fields.add(new TextField({ name: "original_currency", max: 8 }));
    }
    if (!transactions.fields.getByName("original_amount_cents")) {
      transactions.fields.add(
        new NumberField({ name: "original_amount_cents", onlyInt: true, min: 1 }),
      );
    }
    app.save(transactions);
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const currency = transactions.fields.getByName("original_currency");
    if (currency) transactions.fields.removeById(currency.id);
    const amount = transactions.fields.getByName("original_amount_cents");
    if (amount) transactions.fields.removeById(amount.id);
    app.save(transactions);
  },
);
