/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const bills = app.findCollectionByNameOrId("bills");

    if (!bills.fields.getByName("emission_date")) {
      bills.fields.add(new DateField({ name: "emission_date" }));
    }
    if (!bills.fields.getByName("confirmed_at")) {
      bills.fields.add(new DateField({ name: "confirmed_at" }));
    }

    const statusField = bills.fields.getByName("status");
    if (statusField) {
      statusField.values = ["a_confirmar", "pendente", "pago", "cancelado"];
    } else {
      bills.fields.add(
        new SelectField({
          name: "status",
          maxSelect: 1,
          values: ["a_confirmar", "pendente", "pago", "cancelado"],
        }),
      );
    }

    app.save(bills);
  },
  (app) => {
    /* no-op */
  },
);
