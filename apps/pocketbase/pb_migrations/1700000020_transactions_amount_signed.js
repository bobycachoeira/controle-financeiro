/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // Transferências usam valores com sinal: a perna de origem é negativa.
    const transactions = app.findCollectionByNameOrId("transactions");
    const field = transactions.fields.getByName("amount_cents");
    field.min = null;
    app.save(transactions);
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const field = transactions.fields.getByName("amount_cents");
    field.min = 1;
    app.save(transactions);
  },
);
