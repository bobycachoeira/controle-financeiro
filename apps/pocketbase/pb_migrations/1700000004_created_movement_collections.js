/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;
    const householdsId = app.findCollectionByNameOrId("households").id;
    const accountsId = app.findCollectionByNameOrId("accounts").id;
    const cardsId = app.findCollectionByNameOrId("credit_cards").id;
    const categoriesId = app.findCollectionByNameOrId("categories").id;

    function addSyncFields(collection) {
      collection.fields.add(new TextField({ name: "sync_id" }));
      collection.fields.add(
        new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
      );
      collection.fields.add(new DateField({ name: "deleted_at" }));
    }

    const transactions = new Collection({ type: "base", name: "transactions" });
    transactions.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    transactions.fields.add(
      new RelationField({ name: "account", required: true, collectionId: accountsId, maxSelect: 1, cascadeDelete: false }),
    );
    transactions.fields.add(
      new RelationField({ name: "credit_card", collectionId: cardsId, maxSelect: 1, cascadeDelete: false }),
    );
    transactions.fields.add(new NumberField({ name: "amount_cents", required: true, onlyInt: true, min: 1 }));
    transactions.fields.add(new TextField({ name: "currency", max: 8 }));
    transactions.fields.add(
      new SelectField({ name: "type", required: true, maxSelect: 1, values: ["receita", "despesa", "transferencia"] }),
    );
    transactions.fields.add(new DateField({ name: "date", required: true }));
    transactions.fields.add(new DateField({ name: "posting_date" }));
    transactions.fields.add(
      new SelectField({ name: "attribution", maxSelect: 1, values: ["meu", "dela", "ambos", "indefinido"] }),
    );
    transactions.fields.add(
      new RelationField({ name: "payer_user", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    transactions.fields.add(
      new RelationField({ name: "category", collectionId: categoriesId, maxSelect: 1, cascadeDelete: false }),
    );
    transactions.fields.add(new TextField({ name: "description", max: 200 }));
    transactions.fields.add(new SelectField({ name: "status", maxSelect: 1, values: ["pago", "a_pagar"] }));
    transactions.fields.add(new TextField({ name: "recurrence" }));
    transactions.fields.add(new TextField({ name: "installment" }));
    transactions.fields.add(new TextField({ name: "invoice" }));
    transactions.fields.add(new TextField({ name: "transfer" }));
    transactions.fields.add(new FileField({ name: "attachment", maxSelect: 1, maxSize: 5242880 }));
    transactions.fields.add(new JSONField({ name: "tags", maxSize: 5000 }));
    transactions.fields.add(new TextField({ name: "note", max: 1000 }));
    addSyncFields(transactions);
    app.save(transactions);

    const invoices = new Collection({ type: "base", name: "invoices" });
    invoices.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    invoices.fields.add(
      new RelationField({ name: "credit_card", required: true, collectionId: cardsId, maxSelect: 1, cascadeDelete: true }),
    );
    invoices.fields.add(
      new RelationField({ name: "account", required: true, collectionId: accountsId, maxSelect: 1, cascadeDelete: false }),
    );
    invoices.fields.add(new TextField({ name: "reference_month", required: true, max: 7 }));
    invoices.fields.add(new DateField({ name: "closing_date", required: true }));
    invoices.fields.add(new DateField({ name: "due_date", required: true }));
    invoices.fields.add(new NumberField({ name: "total_cents", onlyInt: true }));
    invoices.fields.add(new NumberField({ name: "paid_cents", onlyInt: true }));
    invoices.fields.add(
      new SelectField({ name: "status", maxSelect: 1, values: ["aberta", "fechada", "paga", "vencida"] }),
    );
    invoices.fields.add(new DateField({ name: "closed_at" }));
    invoices.fields.add(new DateField({ name: "paid_at" }));
    invoices.fields.add(new TextField({ name: "note", max: 1000 }));
    addSyncFields(invoices);
    invoices.indexes = ["CREATE UNIQUE INDEX idx_invoices_card_month ON invoices (credit_card, reference_month)"];
    app.save(invoices);

    const installments = new Collection({ type: "base", name: "installments" });
    installments.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    installments.fields.add(new TextField({ name: "installment_group_id", required: true }));
    installments.fields.add(new TextField({ name: "root_transaction" }));
    installments.fields.add(new NumberField({ name: "number", required: true, onlyInt: true, min: 1 }));
    installments.fields.add(new NumberField({ name: "total", required: true, onlyInt: true, min: 1 }));
    installments.fields.add(new NumberField({ name: "amount_cents", required: true, onlyInt: true, min: 1 }));
    installments.fields.add(new DateField({ name: "expected_date", required: true }));
    installments.fields.add(new TextField({ name: "invoice" }));
    installments.fields.add(new BoolField({ name: "paid" }));
    addSyncFields(installments);
    app.save(installments);

    const transfers = new Collection({ type: "base", name: "transfers" });
    transfers.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    transfers.fields.add(
      new RelationField({ name: "source_account", required: true, collectionId: accountsId, maxSelect: 1, cascadeDelete: false }),
    );
    transfers.fields.add(
      new RelationField({ name: "destination_account", required: true, collectionId: accountsId, maxSelect: 1, cascadeDelete: false }),
    );
    transfers.fields.add(new NumberField({ name: "amount_cents", required: true, onlyInt: true, min: 1 }));
    transfers.fields.add(new TextField({ name: "currency", max: 8 }));
    transfers.fields.add(new DateField({ name: "date", required: true }));
    transfers.fields.add(new TextField({ name: "description", max: 200 }));
    transfers.fields.add(new TextField({ name: "source_transaction" }));
    transfers.fields.add(new TextField({ name: "destination_transaction" }));
    addSyncFields(transfers);
    app.save(transfers);

    const bills = new Collection({ type: "base", name: "bills" });
    bills.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    bills.fields.add(new TextField({ name: "title", required: true, min: 1, max: 120 }));
    bills.fields.add(new NumberField({ name: "amount_cents", required: true, onlyInt: true, min: 1 }));
    bills.fields.add(new TextField({ name: "currency", max: 8 }));
    bills.fields.add(new SelectField({ name: "type", required: true, maxSelect: 1, values: ["fixa", "variavel"] }));
    bills.fields.add(new SelectField({ name: "nature", required: true, maxSelect: 1, values: ["entrada", "saida"] }));
    bills.fields.add(new DateField({ name: "due_date", required: true }));
    bills.fields.add(
      new SelectField({
        name: "periodicity",
        maxSelect: 1,
        values: ["unica", "mensal", "bimestral", "trimestral", "anual", "personalizada"],
      }),
    );
    bills.fields.add(
      new SelectField({ name: "status", maxSelect: 1, values: ["pendente", "pago", "cancelado"] }),
    );
    bills.fields.add(new SelectField({ name: "attribution", maxSelect: 1, values: ["meu", "dela", "ambos"] }));
    bills.fields.add(
      new RelationField({ name: "responsible_user", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    bills.fields.add(
      new RelationField({ name: "category", collectionId: categoriesId, maxSelect: 1, cascadeDelete: false }),
    );
    bills.fields.add(new TextField({ name: "recurrence" }));
    bills.fields.add(new JSONField({ name: "reminder_config", maxSize: 20000 }));
    bills.fields.add(new DateField({ name: "last_generation" }));
    bills.fields.add(new DateField({ name: "next_generation" }));
    addSyncFields(bills);
    app.save(bills);
  },
  (app) => {
    ["bills", "transfers", "installments", "invoices", "transactions"].forEach((name) =>
      app.delete(app.findCollectionByNameOrId(name)),
    );
  },
);
