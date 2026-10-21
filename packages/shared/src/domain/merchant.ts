/**
 * Chave canônica para agrupar estabelecimentos digitados manualmente:
 * ignora caixa, acentos e espaços extras, preservando o texto original para
 * exibição. Não há cadastro prévio: o nome nasce no próprio lançamento.
 */
export function normalizeMerchantName(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Estabelecimento do lançamento; usa a descrição como fallback legado. */
export function merchantDisplayName(tx: {
  merchant?: string | null;
  description?: string | null;
}): string {
  return (tx.merchant ?? "").trim() || (tx.description ?? "").trim();
}
