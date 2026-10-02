import { monthOf } from "./dates";

export interface BillLike {
  id: string;
  type: "fixa" | "variavel";
  nature: "entrada" | "saida";
  status: "pendente" | "pago" | "cancelado";
  attribution: "meu" | "dela" | "ambos";
  amount_cents: number;
  due_date: string;
  deleted_at?: string | null;
}

export interface BillsTotals {
  totalEntradaCents: number;
  totalSaidaCents: number;
  pendenteCents: number;
  pagoCents: number;
  canceladoCents: number;
  countPendente: number;
  countPago: number;
}

export function computeBillsTotals(bills: readonly BillLike[], monthISO?: string): BillsTotals {
  const totals: BillsTotals = {
    totalEntradaCents: 0,
    totalSaidaCents: 0,
    pendenteCents: 0,
    pagoCents: 0,
    canceladoCents: 0,
    countPendente: 0,
    countPago: 0,
  };
  for (const bill of bills) {
    if (bill.deleted_at) continue;
    if (monthISO && monthOf(bill.due_date) !== monthISO) continue;
    if (bill.nature === "entrada") totals.totalEntradaCents += bill.amount_cents;
    else totals.totalSaidaCents += bill.amount_cents;

    if (bill.status === "pendente") {
      totals.pendenteCents += bill.amount_cents;
      totals.countPendente += 1;
    } else if (bill.status === "pago") {
      totals.pagoCents += bill.amount_cents;
      totals.countPago += 1;
    } else {
      totals.canceladoCents += bill.amount_cents;
    }
  }
  return totals;
}

export function billsByAttribution(
  bills: readonly BillLike[],
  monthISO?: string,
): Record<"meu" | "dela" | "ambos", number> {
  const result = { meu: 0, dela: 0, ambos: 0 };
  for (const bill of bills) {
    if (bill.deleted_at) continue;
    if (monthISO && monthOf(bill.due_date) !== monthISO) continue;
    if (bill.status === "cancelado") continue;
    result[bill.attribution] += bill.amount_cents;
  }
  return result;
}

export function canTransitionBill(from: BillLike["status"], to: BillLike["status"]): boolean {
  const allowed: Record<BillLike["status"], BillLike["status"][]> = {
    pendente: ["pago", "cancelado"],
    pago: ["pendente"],
    cancelado: ["pendente"],
  };
  return allowed[from].includes(to);
}
