/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const deliveries = app.findCollectionByNameOrId("notification_deliveries");
    const kind = deliveries.fields.getByName("kind");
    if (kind && !kind.values.includes("cobertura")) {
      kind.values = [...kind.values, "cobertura"];
    }
    if (!deliveries.fields.getByName("note")) {
      deliveries.fields.add(new TextField({ name: "note", max: 200 }));
    }
    app.save(deliveries);
  },
  (app) => {
    const deliveries = app.findCollectionByNameOrId("notification_deliveries");
    const kind = deliveries.fields.getByName("kind");
    if (kind) {
      kind.values = kind.values.filter((value) => value !== "cobertura");
    }
    const note = deliveries.fields.getByName("note");
    if (note) deliveries.fields.removeById(note.id);
    app.save(deliveries);
  },
);
