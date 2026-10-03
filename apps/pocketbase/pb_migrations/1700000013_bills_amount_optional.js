/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const bills = app.findCollectionByNameOrId("bills");
    const amountField = bills.fields.getByName("amount_cents");
    if (amountField) {
      amountField.required = false;
      amountField.min = 0;
    }
    app.save(bills);
  },
  (app) => {
    /* no-op */
  },
);
