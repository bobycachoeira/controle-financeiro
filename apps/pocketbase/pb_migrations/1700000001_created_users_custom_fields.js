/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");

    users.fields.add(new TextField({ name: "name", required: true, min: 1, max: 80 }));
    users.fields.add(new FileField({ name: "avatar", maxSelect: 1, maxSize: 2097152, mimeTypes: ["image/jpeg", "image/png", "image/webp"] }));
    users.fields.add(new BoolField({ name: "active" }));
    users.fields.add(new BoolField({ name: "twofa_enabled" }));
    users.fields.add(new BoolField({ name: "twofa_setup_completed" }));
    users.fields.add(new TextField({ name: "twofa_secret_encrypted" }));
    users.fields.add(new JSONField({ name: "recovery_codes_hashed", maxSize: 20000 }));
    users.fields.add(new JSONField({ name: "webauthn_credentials", maxSize: 20000 }));
    users.fields.add(new TextField({ name: "last_known_device", max: 200 }));
    users.fields.add(new DateField({ name: "last_login_at" }));
    users.fields.add(new TextField({ name: "password_hash_custom" }));
    users.fields.add(new TextField({ name: "magic_token_hash" }));
    users.fields.add(new DateField({ name: "magic_token_expires" }));

    return app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    [
      "name",
      "avatar",
      "active",
      "twofa_enabled",
      "twofa_setup_completed",
      "twofa_secret_encrypted",
      "recovery_codes_hashed",
      "webauthn_credentials",
      "last_known_device",
      "last_login_at",
      "password_hash_custom",
      "magic_token_hash",
      "magic_token_expires",
    ].forEach((field) => users.fields.removeByName(field));
    return app.save(users);
  },
);
