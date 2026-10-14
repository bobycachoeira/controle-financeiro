import { describe, expect, it } from "vitest";
import {
  computeSettlement,
  SETTLEMENT_TRANSFER_PREFIX,
  type SettlementPerson,
  type SettlementTransaction,
} from "../src/domain/settlement";

const people: SettlementPerson[] = [
  { key: "paulo", label: "Paulo" },
  { key: "maria", label: "Maria" },
];

function expense(partial: Partial<SettlementTransaction> & { amount_cents: number }): SettlementTransaction {
  return {
    type: "despesa",
    status: "pago",
    attribution: "ambos",
    payer_user: "paulo",
    date: "2026-10-10",
    ...partial,
  };
}

describe("computeSettlement", () => {
  it("zera quando cada um paga o que usou", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [
        expense({ amount_cents: 10000, attribution: "paulo", payer_user: "paulo" }),
        expense({ amount_cents: 5000, attribution: "maria", payer_user: "maria" }),
      ],
    });
    expect(result.people.map((p) => p.netCents)).toEqual([0, 0]);
    expect(result.suggestions).toEqual([]);
    expect(result.consideredCents).toBe(15000);
  });

  it("divide gasto do casal 50/50 e sugere a transferência", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [expense({ amount_cents: 10000, payer_user: "paulo" })],
    });
    const [paulo, maria] = result.people;
    expect(paulo?.paidCents).toBe(10000);
    expect(paulo?.shareCents).toBe(5000);
    expect(paulo?.netCents).toBe(5000);
    expect(maria?.netCents).toBe(-5000);
    expect(result.suggestions).toEqual([
      { fromKey: "maria", toKey: "paulo", amountCents: 5000 },
    ]);
  });

  it("mapeia atribuições legadas (meu/dela) para as pessoas atuais", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      legacyMap: { meu: 0, dela: 1 },
      transactions: [
        expense({ amount_cents: 4000, attribution: "meu", payer_user: "paulo" }),
        expense({ amount_cents: 6000, attribution: "dela", payer_user: "maria" }),
      ],
    });
    expect(result.people.map((p) => p.netCents)).toEqual([0, 0]);
  });

  it("ignora despesas sem pagador identificado", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [expense({ amount_cents: 3000, payer_user: null })],
    });
    expect(result.ignoredCents).toBe(3000);
    expect(result.consideredCents).toBe(0);
    expect(result.suggestions).toEqual([]);
  });

  it("abate acertos já registrados no mês", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [expense({ amount_cents: 10000, payer_user: "paulo" })],
      transfers: [
        {
          amount_cents: 5000,
          date: "2026-10-20",
          description: `${SETTLEMENT_TRANSFER_PREFIX} 2026-10`,
          source_owner: "maria",
          destination_owner: "paulo",
        },
      ],
    });
    expect(result.people.map((p) => p.netCents)).toEqual([0, 0]);
    expect(result.suggestions).toEqual([]);
  });

  it("rateia centavos ímpares sem perder valor", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [expense({ amount_cents: 101, payer_user: "paulo" })],
    });
    const [paulo, maria] = result.people;
    expect(paulo?.shareCents).toBe(51);
    expect(maria?.shareCents).toBe(50);
    expect((paulo?.shareCents ?? 0) + (maria?.shareCents ?? 0)).toBe(101);
  });

  it("considera só o mês pedido", () => {
    const result = computeSettlement({
      people,
      month: "2026-10",
      transactions: [
        expense({ amount_cents: 5000, date: "2026-09-30" }),
        expense({ amount_cents: 7000, date: "2026-10-01" }),
      ],
    });
    expect(result.consideredCents).toBe(7000);
  });
});
