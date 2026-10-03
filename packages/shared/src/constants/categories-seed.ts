import type { CategoryKind } from "./domain";

export interface SeedCategory {
  name: string;
  kind: CategoryKind;
  group: string;
  color: string;
  icon: string;
  order: number;
}

export const CATEGORIES_SEED: readonly SeedCategory[] = [
  // Entradas
  { name: "Salário", kind: "entrada", group: "Renda", color: "#16a34a", icon: "wallet", order: 1 },
  { name: "Freelance", kind: "entrada", group: "Renda", color: "#22c55e", icon: "laptop", order: 2 },
  { name: "13º salário", kind: "entrada", group: "Renda", color: "#15803d", icon: "gift", order: 3 },
  { name: "Férias", kind: "entrada", group: "Renda", color: "#0ea5e9", icon: "plane", order: 4 },
  { name: "Rendimentos", kind: "entrada", group: "Renda", color: "#14b8a6", icon: "banknote", order: 5 },
  { name: "Vendas", kind: "entrada", group: "Renda", color: "#84cc16", icon: "package", order: 6 },
  {
    name: "Reembolso",
    kind: "entrada",
    group: "Renda",
    color: "#06b6d4",
    icon: "hand-coins",
    order: 7,
  },
  {
    name: "Bolsa/Auxílio",
    kind: "entrada",
    group: "Renda",
    color: "#8b5cf6",
    icon: "graduation-cap",
    order: 8,
  },
  {
    name: "Presente recebido",
    kind: "entrada",
    group: "Renda",
    color: "#ec4899",
    icon: "gift",
    order: 9,
  },
  {
    name: "Aluguel recebido",
    kind: "entrada",
    group: "Renda",
    color: "#0ea5e9",
    icon: "home",
    order: 10,
  },
  {
    name: "Outras receitas",
    kind: "entrada",
    group: "Renda",
    color: "#4ade80",
    icon: "plus-circle",
    order: 11,
  },

  // Saídas — Casa
  { name: "Moradia", kind: "saida", group: "Casa", color: "#0ea5e9", icon: "home", order: 20 },
  { name: "Aluguel", kind: "saida", group: "Casa", color: "#0284c7", icon: "key", order: 21 },
  { name: "Condomínio", kind: "saida", group: "Casa", color: "#0369a1", icon: "building", order: 22 },
  { name: "Energia", kind: "saida", group: "Casa", color: "#eab308", icon: "zap", order: 23 },
  { name: "Água", kind: "saida", group: "Casa", color: "#06b6d4", icon: "droplet", order: 24 },
  { name: "Internet", kind: "saida", group: "Casa", color: "#8b5cf6", icon: "wifi", order: 25 },
  { name: "Gás", kind: "saida", group: "Casa", color: "#ef4444", icon: "fuel", order: 26 },
  { name: "Telefone", kind: "saida", group: "Casa", color: "#6366f1", icon: "wifi", order: 27 },

  // Alimentação
  {
    name: "Alimentação",
    kind: "saida",
    group: "Alimentação",
    color: "#f97316",
    icon: "utensils",
    order: 30,
  },
  {
    name: "Supermercado",
    kind: "saida",
    group: "Alimentação",
    color: "#ea580c",
    icon: "shopping-cart",
    order: 31,
  },
  {
    name: "Restaurantes",
    kind: "saida",
    group: "Alimentação",
    color: "#fb923c",
    icon: "utensils-crossed",
    order: 32,
  },
  { name: "Delivery", kind: "saida", group: "Alimentação", color: "#f59e0b", icon: "coffee", order: 33 },

  // Transporte
  { name: "Transporte", kind: "saida", group: "Transporte", color: "#3b82f6", icon: "car", order: 40 },
  {
    name: "Combustível",
    kind: "saida",
    group: "Transporte",
    color: "#2563eb",
    icon: "fuel",
    order: 41,
  },
  { name: "Ônibus/Metrô", kind: "saida", group: "Transporte", color: "#1d4ed8", icon: "bus", order: 42 },
  { name: "Aplicativos", kind: "saida", group: "Transporte", color: "#60a5fa", icon: "bike", order: 43 },

  // Saúde
  { name: "Saúde", kind: "saida", group: "Saúde", color: "#ef4444", icon: "heart", order: 50 },
  { name: "Farmácia", kind: "saida", group: "Saúde", color: "#dc2626", icon: "pill", order: 51 },
  {
    name: "Plano de Saúde",
    kind: "saida",
    group: "Saúde",
    color: "#f87171",
    icon: "heart",
    order: 52,
  },

  // Educação
  {
    name: "Educação",
    kind: "saida",
    group: "Educação",
    color: "#14b8a6",
    icon: "graduation-cap",
    order: 60,
  },
  { name: "Cursos", kind: "saida", group: "Educação", color: "#0d9488", icon: "book", order: 61 },

  // Lazer & Pessoal
  { name: "Lazer", kind: "saida", group: "Lazer", color: "#a855f7", icon: "gamepad-2", order: 70 },
  { name: "Viagens", kind: "saida", group: "Lazer", color: "#7c3aed", icon: "plane", order: 71 },
  { name: "Academia", kind: "saida", group: "Lazer", color: "#f43f5e", icon: "dumbbell", order: 72 },

  // Compras
  { name: "Vestuário", kind: "saida", group: "Compras", color: "#ec4899", icon: "shirt", order: 80 },
  { name: "Presentes", kind: "saida", group: "Compras", color: "#db2777", icon: "gift", order: 81 },

  // Assinaturas
  {
    name: "Assinaturas",
    kind: "saida",
    group: "Assinaturas",
    color: "#6366f1",
    icon: "repeat",
    order: 90,
  },

  // Filhos/Família
  { name: "Escola", kind: "saida", group: "Família", color: "#0ea5e9", icon: "school", order: 95 },
  { name: "Filhos", kind: "saida", group: "Família", color: "#f472b6", icon: "baby", order: 96 },
  { name: "Pets", kind: "saida", group: "Família", color: "#a16207", icon: "dog", order: 97 },

  // Ambos (entrada e saída)
  { name: "Outros", kind: "ambos", group: "Geral", color: "#64748b", icon: "tag", order: 100 },
  { name: "Ajustes", kind: "ambos", group: "Geral", color: "#9333ea", icon: "sparkles", order: 101 },
  { name: "Estornos", kind: "ambos", group: "Geral", color: "#0891b2", icon: "repeat", order: 102 },
  {
    name: "Transferências",
    kind: "ambos",
    group: "Geral",
    color: "#475569",
    icon: "repeat",
    order: 103,
  },
];
