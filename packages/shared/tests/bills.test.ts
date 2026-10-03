import { describe, expect, it } from "vitest";
import {
  billDueDate,
  billsByAttribution,
  canTransitionBill,
  computeBillsTotals,
} from "../src/domain/bills";
import type { BillLike } from "../src/domain/bills";

const bills: BillLike[] = [
  {
    id: "1",
    type: "fixa",
    nature: "saida",
    status: "pendente",
    attribution: "meu",
    amount_cents: 10000,
    due_date: "2024-03-05",
  },
  {
    id: "2",
    type: "variavel",
    nature: "saida",
    status: "pago",
    attribution: "dela",
    amount_cents: 20000,
    due_date: "2024-03-10",
  },
  {
    id: "3",
    type: "fixa",
    nature: "entrada",
    status: "pendente",
    attribution: "ambos",
    amount_cents: 30000,
    due_date: "2024-03-20",
  },
  {
    id: "4",
    type: "fixa",
    nature: "saida",
    status: "cancelado",
    attribution: "ambos",
    amount_cents: 5000,
    due_date: "2024-03-25",
  },
  {
    id: "5",
    type: "fixa",
    nature: "saida",
    status: "pendente",
    attribution: "meu",
    amount_cents: 10000,
    due_date: "2024-04-05",
  },
];

describe("bill totals", () => {
  it("aggregates totals for the requested month", () => {
    const totals = computeBillsTotals(bills, "2024-03");
    expect(totals.totalEntradaCents).toBe(30000);
    expect(totals.totalSaidaCents).toBe(35000);
    expect(totals.pendenteCents).toBe(40000);
    expect(totals.pagoCents).toBe(20000);
    expect(totals.canceladoCents).toBe(5000);
    expect(totals.countPendente).toBe(2);
    expect(totals.countPago).toBe(1);
  });

  it("groups by attribution ignoring cancelled bills", () => {
    const byAttribution = billsByAttribution(bills, "2024-03");
    expect(byAttribution.meu).toBe(10000);
    expect(byAttribution.dela).toBe(20000);
    expect(byAttribution.ambos).toBe(30000);
  });

  it("enforces allowed status transitions", () => {
    expect(canTransitionBill("a_confirmar", "pendente")).toBe(true);
    expect(canTransitionBill("pendente", "pago")).toBe(true);
    expect(canTransitionBill("pendente", "cancelado")).toBe(true);
    expect(canTransitionBill("pago", "pendente")).toBe(true);
    expect(canTransitionBill("cancelado", "pago")).toBe(false);
  });

  it("computes the due date from the emission date with clamp and month roll", () => {
    expect(billDueDate("2024-03-12", 20)).toBe("2024-03-20");
    expect(billDueDate("2024-03-25", 5)).toBe("2024-04-05");
    expect(billDueDate("2024-03-12", 31)).toBe("2024-03-31");
    expect(billDueDate("2024-02-12", 31)).toBe("2024-02-29");
  });

  it("separates bills awaiting confirmation in the totals", () => {
    const totals = computeBillsTotals(
      [
        {
          id: "1",
          type: "variavel",
          nature: "saida",
          status: "a_confirmar",
          attribution: "ambos",
          amount_cents: 0,
          due_date: "2024-03-20",
        },
      ],
      "2024-03",
    );
    expect(totals.countAConfirmar).toBe(1);
    expect(totals.countPendente).toBe(0);
  });
});
