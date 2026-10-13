import { describe, expect, it } from "vitest";
import { transactionSchema } from "../src/entities/movements";

const base = {
  id: "t1",
  household: "h1",
  sync_id: "s1",
  account: "a1",
  currency: "BRL",
  date: "2024-03-10",
  attribution: "indefinido",
  status: "pago",
};

describe("transactionSchema (sinal do valor)", () => {
  it("aceita transferência com valor negativo (perna de origem)", () => {
    const result = transactionSchema.safeParse({
      ...base,
      type: "transferencia",
      amount_cents: -5000,
      transfer: "tr1",
    });
    expect(result.success).toBe(true);
  });

  it("aceita transferência com valor positivo (perna de destino)", () => {
    const result = transactionSchema.safeParse({
      ...base,
      type: "transferencia",
      amount_cents: 5000,
      transfer: "tr1",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita despesa/receita com valor <= 0", () => {
    expect(transactionSchema.safeParse({ ...base, type: "despesa", amount_cents: 0 }).success).toBe(
      false,
    );
    expect(
      transactionSchema.safeParse({ ...base, type: "receita", amount_cents: -100 }).success,
    ).toBe(false);
  });
});
