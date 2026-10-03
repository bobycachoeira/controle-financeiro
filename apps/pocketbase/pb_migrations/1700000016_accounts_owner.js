/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const accounts = app.findCollectionByNameOrId("accounts");
    if (!accounts.fields.getByName("owner")) {
      accounts.fields.add(
        new SelectField({
          name: "owner",
          maxSelect: 1,
          values: ["meu", "dela", "ambos", "indefinido"],
        }),
      );
    }
    app.save(accounts);
  },
  (app) => {
    /* no-op */
  },
);
