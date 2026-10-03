import { monthOf } from "./dates";

export interface BillLike {
  id: string;
  type: "fixa" | "variavel";
  nature: "entrada" | "saida";
  status: "a_confirmar" | "pendente" | "pago" | "cancelado";
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
  aConfirmarCents: number;
  countPendente: number;
  countPago: number;
  countAConfirmar: number;
}

export function computeBillsTotals(bills: readonly BillLike[], monthISO?: string): BillsTotals {
  const totals: BillsTotals = {
    totalEntradaCents: 0,
    totalSaidaCents: 0,
    pendenteCents: 0,
    pagoCents: 0,
    canceladoCents: 0,
    aConfirmarCents: 0,
    countPendente: 0,
    countPago: 0,
    countAConfirmar: 0,
  };
  for (const bill of bills) {
    if (bill.deleted_at) continue;
    if (monthISO && monthOf(bill.due_date) !== monthISO) continue;
    if (bill.nature === "entrada") totals.totalEntradaCents += bill.amount_cents;
    else totals.totalSaidaCents += bill.amount_cents;

    if (bill.status === "a_confirmar") {
      totals.aConfirmarCents += bill.amount_cents;
      totals.countAConfirmar += 1;
    } else if (bill.status === "pendente") {
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
    a_confirmar: ["pendente", "pago", "cancelado"],
    pendente: ["pago", "cancelado"],
    pago: ["pendente"],
    cancelado: ["pendente"],
  };
  return allowed[from].includes(to);
}

/**
 * Data de vencimento de uma conta emitida: usa o dia de vencimento cadastrado
 * no mês da emissão; se o dia de vencimento for anterior ao de emissão, rola
 * para o mês seguinte. Com clamp para meses curtos.
 */
export function billDueDate(emissionDate: string, dueDay: number): string {
  const [year, month, day] = emissionDate.split("-").map(Number);
  const emission = { year: year ?? 0, month: month ?? 1, day: day ?? 1 };
  if (dueDay >= emission.day) {
    return `${emissionDate.slice(0, 7)}-${String(Math.min(dueDay, daysInMonthOf(emission.year, emission.month))).padStart(2, "0")}`;
  }
  const next = addMonthsOf(emission.year, emission.month, 1);
  const clamped = Math.min(dueDay, daysInMonthOf(next.year, next.month));
  return `${next.year}-${String(next.month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

function daysInMonthOf(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsOf(year: number, month: number, delta: number): { year: number; month: number } {
  const zeroBased = month - 1 + delta;
  return { year: year + Math.floor(zeroBased / 12), month: ((zeroBased % 12) + 12) % 12 + 1 };
}
