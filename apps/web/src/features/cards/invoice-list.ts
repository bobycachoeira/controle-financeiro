import type { LocalInvoice } from "@/db/schema";

/**
 * Faturas visíveis no cartão: as **próximas a pagar** (não pagas, da mais
 * antiga para a mais nova). Se sobrar espaço, completa com as últimas pagas.
 * Expandido, devolve todas: em aberto da mais antiga para a mais nova e as
 * pagas por último (mais recentes primeiro).
 */
export function pickVisibleInvoices(
  invoices: readonly LocalInvoice[],
  expanded: boolean,
): LocalInvoice[] {
  const ascending = [...invoices].sort((a, b) => (a.reference_month < b.reference_month ? -1 : 1));
  const unpaid = ascending.filter((invoice) => invoice.status !== "paga");
  const paid = [...ascending].reverse().filter((invoice) => invoice.status === "paga");

  if (expanded) return [...unpaid, ...paid];

  const visible = unpaid.slice(0, 2);
  for (const invoice of paid) {
    if (visible.length >= 2) break;
    visible.push(invoice);
  }
  return visible.sort((a, b) => (a.reference_month < b.reference_month ? -1 : 1));
}
