/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (users.fields.getByName("avatar")) {
      users.fields.removeByName("avatar");
    }
    // Avatar como data URL (imagem pequena, redimensionada no cliente).
    users.fields.add(new TextField({ name: "avatar", max: 400000 }));
    return app.save(users);
  },
  (app) => {
    const users = app.findCollectionByNameOrId("users");
    if (users.fields.getByName("avatar")) {
      users.fields.removeByName("avatar");
    }
    users.fields.add(
      new FileField({
        name: "avatar",
        maxSelect: 1,
        maxSize: 2097152,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
      }),
    );
    return app.save(users);
  },
);
