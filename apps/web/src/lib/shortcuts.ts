export interface ShortcutOption {
  name: string;
  label: string;
  icon: string;
}

export const SHORTCUT_OPTIONS: readonly ShortcutOption[] = [
  { name: "transaction-new", label: "Novo lançamento", icon: "plus-circle" },
  { name: "transfers", label: "Transferir", icon: "repeat" },
  { name: "bills", label: "Contas", icon: "receipt" },
  { name: "recurrences", label: "Recorrências", icon: "repeat" },
  { name: "review", label: "Revisar", icon: "tag" },
  { name: "settle", label: "Acerto", icon: "hand-coins" },
  { name: "goals", label: "Metas e cofrinhos", icon: "piggy-bank" },
  { name: "budgets", label: "Orçamentos", icon: "piggy-bank" },
  { name: "calendar", label: "Calendário", icon: "calendar-clock" },
  { name: "closing", label: "Fechamento", icon: "calendar-clock" },
  { name: "investments", label: "Investimentos", icon: "coins" },
  { name: "import", label: "Importar dados", icon: "package" },
  { name: "categories", label: "Categorias", icon: "tag" },
  { name: "currencies", label: "Moedas", icon: "banknote" },
];

export const DEFAULT_SHORTCUTS: readonly string[] = [
  "transaction-new",
  "transfers",
  "goals",
  "import",
];

export const MAX_SHORTCUTS = 8;

export function shortcutOption(name: string): ShortcutOption | undefined {
  return SHORTCUT_OPTIONS.find((option) => option.name === name);
}
