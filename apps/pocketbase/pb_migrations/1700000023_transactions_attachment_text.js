/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const attachment = transactions.fields.getByName("attachment");
    // O anexo vira texto (data URL comprimida) para funcionar offline-first
    // pelo mesmo fluxo de sincronização das transações.
    if (attachment && attachment.type !== "text") {
      transactions.fields.removeById(attachment.id);
      transactions.fields.add(new TextField({ name: "attachment" }));
      app.save(transactions);
    }
  },
  (app) => {
    const transactions = app.findCollectionByNameOrId("transactions");
    const attachment = transactions.fields.getByName("attachment");
    if (attachment && attachment.type !== "file") {
      transactions.fields.removeById(attachment.id);
      transactions.fields.add(new FileField({ name: "attachment", maxSelect: 1, maxSize: 5242880 }));
      app.save(transactions);
    }
  },
);
