/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const categories = app.findCollectionByNameOrId("categories");
    const kindField = categories.fields.getByName("kind");
    if (kindField) {
      kindField.values = ["entrada", "saida", "ambos"];
    } else {
      categories.fields.add(
        new SelectField({ name: "kind", required: true, maxSelect: 1, values: ["entrada", "saida", "ambos"] }),
      );
    }
    app.save(categories);
  },
  (app) => {
    /* no-op */
  },
);
