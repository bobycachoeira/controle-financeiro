export function describeSyncError(error?: string | null): string {
  if (!error) return "Erro desconhecido";
  if (/fetch|network|load failed|failed to fetch|networkerror/i.test(error)) {
    return "Sem conexão com o servidor";
  }
  if (/rate_limited|429|many requests/i.test(error)) {
    return "Muitas sincronizações — aguarde um instante";
  }
  if (/validation_error|invalid/i.test(error)) {
    return "Um item foi rejeitado por dados inválidos";
  }
  if (/forbidden|403/i.test(error)) {
    return "Sem permissão para enviar um item";
  }
  if (/unauthorized|401|token|expired/i.test(error)) {
    return "Sessão expirada — entre novamente";
  }
  if (/already_exists|duplicate|unique/i.test(error)) {
    return "Item duplicado";
  }
  return error;
}

const ENTITY_LABELS: Record<string, string> = {
  households: "Família",
  household_members: "Membros",
  accounts: "Conta",
  credit_cards: "Cartão",
  categories: "Categoria",
  transactions: "Lançamento",
  installments: "Parcela",
  invoices: "Fatura",
  transfers: "Transferência",
  bills: "Conta a pagar/receber",
  recurrences: "Recorrência",
  budgets: "Orçamento",
  exchange_rates: "Cotação",
};

export function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

const OPERATION_LABELS: Record<string, string> = {
  create: "criar",
  update: "editar",
  delete: "excluir",
};

export function operationLabel(operation: string): string {
  return OPERATION_LABELS[operation] ?? operation;
}
