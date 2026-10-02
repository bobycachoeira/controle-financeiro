/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const seed = [
      { name: "Salário", kind: "entrada", group: "Renda", color: "#16a34a", icon: "wallet", order: 1 },
      { name: "Freelance", kind: "entrada", group: "Renda", color: "#22c55e", icon: "laptop", order: 2 },
      { name: "Outras receitas", kind: "entrada", group: "Renda", color: "#4ade80", icon: "plus-circle", order: 3 },
      { name: "Moradia", kind: "saida", group: "Casa", color: "#0ea5e9", icon: "home", order: 10 },
      { name: "Aluguel", kind: "saida", group: "Casa", color: "#0284c7", icon: "key", order: 11 },
      { name: "Condomínio", kind: "saida", group: "Casa", color: "#0369a1", icon: "building", order: 12 },
      { name: "Energia", kind: "saida", group: "Casa", color: "#eab308", icon: "zap", order: 13 },
      { name: "Água", kind: "saida", group: "Casa", color: "#06b6d4", icon: "droplet", order: 14 },
      { name: "Internet", kind: "saida", group: "Casa", color: "#8b5cf6", icon: "wifi", order: 15 },
      { name: "Alimentação", kind: "saida", group: "Alimentação", color: "#f97316", icon: "utensils", order: 20 },
      { name: "Supermercado", kind: "saida", group: "Alimentação", color: "#ea580c", icon: "shopping-cart", order: 21 },
      { name: "Restaurantes", kind: "saida", group: "Alimentação", color: "#fb923c", icon: "utensils-crossed", order: 22 },
      { name: "Transporte", kind: "saida", group: "Transporte", color: "#3b82f6", icon: "car", order: 30 },
      { name: "Combustível", kind: "saida", group: "Transporte", color: "#2563eb", icon: "fuel", order: 31 },
      { name: "Saúde", kind: "saida", group: "Saúde", color: "#ef4444", icon: "heart", order: 40 },
      { name: "Farmácia", kind: "saida", group: "Saúde", color: "#dc2626", icon: "pill", order: 41 },
      { name: "Educação", kind: "saida", group: "Educação", color: "#14b8a6", icon: "graduation-cap", order: 50 },
      { name: "Lazer", kind: "saida", group: "Lazer", color: "#a855f7", icon: "gamepad-2", order: 60 },
      { name: "Vestuário", kind: "saida", group: "Compras", color: "#ec4899", icon: "shirt", order: 70 },
      { name: "Assinaturas", kind: "saida", group: "Assinaturas", color: "#6366f1", icon: "repeat", order: 80 },
      { name: "Outros", kind: "saida", group: "Outros", color: "#64748b", icon: "tag", order: 99 },
    ];

    const households = app.findAllRecords(app.findCollectionByNameOrId("households"));
    const categories = app.findCollectionByNameOrId("categories");
    for (const household of households) {
      const existing = app
        .findAllRecords(categories, $dbx.hashExp({ household: household.id }))
        .filter((record) => record.getBool("system"));
      if (existing.length > 0) continue;

      for (const item of seed) {
        const record = new Record(categories);
        record.set("household", household.id);
        record.set("name", item.name);
        record.set("kind", item.kind);
        record.set("group", item.group);
        record.set("color", item.color);
        record.set("icon", item.icon);
        record.set("system", true);
        record.set("active", true);
        record.set("order", item.order);
        app.save(record);
      }
    }
  },
  () => {
    /* no-op */
  },
);
