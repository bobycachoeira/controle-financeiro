/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const goals = app.findCollectionByNameOrId("goals");
    if (!goals.fields.getByName("cofrinho_account")) {
      goals.fields.add(new TextField({ name: "cofrinho_account", max: 60 }));
    }
    app.save(goals);
  },
  (app) => {
    const goals = app.findCollectionByNameOrId("goals");
    const field = goals.fields.getByName("cofrinho_account");
    if (field) goals.fields.removeById(field.id);
    app.save(goals);
  },
);
