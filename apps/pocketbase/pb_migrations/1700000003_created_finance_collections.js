/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;

    function addSyncFields(collection) {
      collection.fields.add(new TextField({ name: "sync_id" }));
      collection.fields.add(
        new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
      );
      collection.fields.add(new DateField({ name: "deleted_at" }));
    }

    const accounts = new Collection({ type: "base", name: "accounts" });
    accounts.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    accounts.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    accounts.fields.add(
      new SelectField({
        name: "type",
        required: true,
        maxSelect: 1,
        values: ["corrente", "poupanca", "carteira", "cartao_credito", "investimento", "outros"],
      }),
    );
    accounts.fields.add(new TextField({ name: "currency", max: 8 }));
    accounts.fields.add(new NumberField({ name: "initial_balance_cents", onlyInt: true }));
    accounts.fields.add(new BoolField({ name: "include_in_total" }));
    accounts.fields.add(new BoolField({ name: "active" }));
    accounts.fields.add(new NumberField({ name: "order", onlyInt: true }));
    accounts.fields.add(new TextField({ name: "color", max: 32 }));
    accounts.fields.add(new TextField({ name: "icon", max: 64 }));
    addSyncFields(accounts);
    app.save(accounts);

    const accountsId = app.findCollectionByNameOrId("accounts").id;

    const cards = new Collection({ type: "base", name: "credit_cards" });
    cards.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    cards.fields.add(
      new RelationField({ name: "account", required: true, collectionId: accountsId, maxSelect: 1, cascadeDelete: false }),
    );
    cards.fields.add(new TextField({ name: "bank", max: 80 }));
    cards.fields.add(new NumberField({ name: "limit_cents", onlyInt: true }));
    cards.fields.add(new TextField({ name: "currency", max: 8 }));
    cards.fields.add(new NumberField({ name: "closing_day", required: true, onlyInt: true, min: 1, max: 31 }));
    cards.fields.add(new NumberField({ name: "due_day", required: true, onlyInt: true, min: 1, max: 31 }));
    cards.fields.add(new BoolField({ name: "purchase_at_posting" }));
    cards.fields.add(new BoolField({ name: "uses_account_balance_for_invoice" }));
    cards.fields.add(new BoolField({ name: "active" }));
    addSyncFields(cards);
    cards.indexes = ["CREATE UNIQUE INDEX idx_cards_account ON credit_cards (account)"];
    app.save(cards);

    const categories = new Collection({ type: "base", name: "categories" });
    categories.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    categories.fields.add(new TextField({ name: "name", required: true, min: 1, max: 60 }));
    categories.fields.add(
      new SelectField({ name: "kind", required: true, maxSelect: 1, values: ["entrada", "saida"] }),
    );
    categories.fields.add(new TextField({ name: "group", required: true, max: 60 }));
    categories.fields.add(new TextField({ name: "color", max: 32 }));
    categories.fields.add(new TextField({ name: "icon", max: 64 }));
    categories.fields.add(new BoolField({ name: "system" }));
    categories.fields.add(new BoolField({ name: "active" }));
    categories.fields.add(new NumberField({ name: "order", onlyInt: true }));
    addSyncFields(categories);
    app.save(categories);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("categories"));
    app.delete(app.findCollectionByNameOrId("credit_cards"));
    app.delete(app.findCollectionByNameOrId("accounts"));
  },
);
