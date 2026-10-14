/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const deliveries = app.findCollectionByNameOrId("notification_deliveries");
    const kind = deliveries.fields.getByName("kind");
    if (kind && !kind.values.includes("orcamento")) {
      kind.values = [...kind.values, "orcamento"];
      app.save(deliveries);
    }
  },
  (app) => {
    const deliveries = app.findCollectionByNameOrId("notification_deliveries");
    const kind = deliveries.fields.getByName("kind");
    if (kind) {
      kind.values = kind.values.filter((value) => value !== "orcamento");
      app.save(deliveries);
    }
  },
);
