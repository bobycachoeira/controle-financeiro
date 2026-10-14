/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;

    const goals = new Collection({ type: "base", name: "goals" });
    goals.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    goals.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    goals.fields.add(new NumberField({ name: "target_cents", required: true, onlyInt: true, min: 1 }));
    goals.fields.add(new DateField({ name: "deadline" }));
    goals.fields.add(new TextField({ name: "color", max: 32 }));
    goals.fields.add(new TextField({ name: "icon", max: 64 }));
    goals.fields.add(new TextField({ name: "owner", max: 60 }));
    goals.fields.add(new BoolField({ name: "active" }));
    goals.fields.add(new JSONField({ name: "entries", maxSize: 200000 }));
    goals.fields.add(new TextField({ name: "sync_id" }));
    goals.fields.add(
      new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    goals.fields.add(new DateField({ name: "deleted_at" }));
    goals.fields.add(new AutodateField({ name: "created", system: true, onCreate: true }));
    goals.fields.add(
      new AutodateField({ name: "updated", system: true, onCreate: true, onUpdate: true }),
    );
    goals.indexes = ["CREATE INDEX idx_goals_household ON goals (household)"];
    app.save(goals);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("goals"));
  },
);
