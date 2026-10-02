/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const usersId = app.findCollectionByNameOrId("users").id;

    const households = new Collection({ type: "base", name: "households" });
    households.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    households.fields.add(new TextField({ name: "base_currency", max: 8 }));
    households.fields.add(new JSONField({ name: "supported_currencies", maxSize: 2000 }));
    households.fields.add(new JSONField({ name: "settings", maxSize: 20000 }));
    households.fields.add(
      new RelationField({ name: "created_by", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    households.fields.add(new TextField({ name: "sync_id" }));
    households.fields.add(
      new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    households.fields.add(new DateField({ name: "deleted_at" }));
    app.save(households);

    const householdsId = app.findCollectionByNameOrId("households").id;

    const members = new Collection({ type: "base", name: "household_members" });
    members.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    members.fields.add(
      new RelationField({ name: "user", required: true, collectionId: usersId, maxSelect: 1, cascadeDelete: true }),
    );
    members.fields.add(
      new SelectField({ name: "role", required: true, maxSelect: 1, values: ["owner", "partner", "teen", "child", "viewer"] }),
    );
    members.fields.add(new SelectField({ name: "invite_status", maxSelect: 1, values: ["pending", "accepted"] }));
    members.fields.add(new JSONField({ name: "permissions", maxSize: 20000 }));
    members.fields.add(new DateField({ name: "joined_at" }));
    members.fields.add(new TextField({ name: "sync_id" }));
    members.fields.add(
      new RelationField({ name: "updated_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    members.fields.add(new DateField({ name: "deleted_at" }));
    members.indexes = ["CREATE UNIQUE INDEX idx_members_household_user ON household_members (household, user)"];
    app.save(members);

    const invites = new Collection({ type: "base", name: "invites" });
    invites.fields.add(
      new RelationField({ name: "household", required: true, collectionId: householdsId, maxSelect: 1, cascadeDelete: true }),
    );
    invites.fields.add(
      new SelectField({ name: "role", required: true, maxSelect: 1, values: ["partner", "teen", "child", "viewer"] }),
    );
    invites.fields.add(new EmailField({ name: "email_invited", required: true }));
    invites.fields.add(new TextField({ name: "token_hash", required: true }));
    invites.fields.add(new DateField({ name: "expires_at", required: true }));
    invites.fields.add(new DateField({ name: "used_at" }));
    invites.fields.add(
      new RelationField({ name: "used_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    invites.fields.add(new NumberField({ name: "max_uses", onlyInt: true }));
    invites.fields.add(new BoolField({ name: "single_use" }));
    invites.fields.add(
      new RelationField({ name: "created_by", collectionId: usersId, maxSelect: 1, cascadeDelete: false }),
    );
    app.save(invites);
  },
  (app) => {
    app.delete(app.findCollectionByNameOrId("invites"));
    app.delete(app.findCollectionByNameOrId("household_members"));
    app.delete(app.findCollectionByNameOrId("households"));
  },
);
