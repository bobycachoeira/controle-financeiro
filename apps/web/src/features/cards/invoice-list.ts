import type { LocalInvoice } from "@/db/schema";

/**
 * Faturas visíveis no cartão: as **próximas a pagar** (não pagas, da mais
 * antiga para a mais nova). Se sobrar espaço, completa com as últimas pagas.
 * Expandido, devolve todas (mais recentes primeiro).
 */
export function pickVisibleInvoices(
  invoices: readonly LocalInvoice[],
  expanded: boolean,
): LocalInvoice[] {
  const list = [...invoices].sort((a, b) =>
    a.reference_month < b.reference_month ? 1 : -1,
  );
  if (expanded) return list;

  const ascending = [...list].reverse();
  const visible = ascending.filter((invoice) => invoice.status !== "paga").slice(0, 2);
  if (visible.length < 2) {
    const paid = [...ascending].reverse().filter((invoice) => invoice.status === "paga");
    for (const invoice of paid) {
      if (visible.length >= 2) break;
      visible.push(invoice);
    }
  }
  return visible.sort((a, b) => (a.reference_month < b.reference_month ? -1 : 1));
}
