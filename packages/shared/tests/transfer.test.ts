import { describe, expect, it } from "vitest";
import {
  buildTransferTransactions,
  validateTransfer,
} from "../src/domain/transfer";

describe("transfer rules", () => {
  it("rejects transferring to the same account", () => {
    const result = validateTransfer({
      source_account: "a",
      destination_account: "a",
      amount_cents: 1000,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("same_account");
  });

  it("rejects non-positive or fractional amounts", () => {
    expect(
      validateTransfer({ source_account: "a", destination_account: "b", amount_cents: 0 })
        .valid,
    ).toBe(false);
    expect(
      validateTransfer({ source_account: "a", destination_account: "b", amount_cents: 10.5 })
        .valid,
    ).toBe(false);
  });

  it("builds paired transactions that do not affect income/expense totals", () => {
    const transactions = buildTransferTransactions({
      id: "t1",
      household: "h1",
      source_account: "a",
      destination_account: "b",
      amount_cents: 5000,
      date: "2024-03-10",
    });
    expect(transactions).toHaveLength(2);
    expect(transactions.every((tx) => tx.type === "transferencia")).toBe(true);
    const net = transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);
    expect(net).toBe(0);
  });
});
