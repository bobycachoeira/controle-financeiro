import { describe, expect, it } from "vitest";
import { accountSchema, transactionSchema, householdMemberSchema } from "@cf/shared";

describe("entity schemas (contract)", () => {
  it("validates an account with defaults", () => {
    const parsed = accountSchema.safeParse({
      id: "a1",
      household: "h1",
      sync_id: "00000000-0000-4000-8000-000000000001",
      name: "Corrente",
      type: "corrente",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.currency).toBe("BRL");
      expect(parsed.data.initial_balance_cents).toBe(0);
    }
  });

  it("rejects a transaction with non-positive amount", () => {
    const parsed = transactionSchema.safeParse({
      id: "t1",
      household: "h1",
      sync_id: "00000000-0000-4000-8000-000000000001",
      account: "a1",
      amount_cents: 0,
      type: "despesa",
      date: "2024-03-01",
    });
    expect(parsed.success).toBe(false);
  });

  it("validates a member with a known role only", () => {
    expect(
      householdMemberSchema.safeParse({
        id: "m1",
        household: "h1",
        sync_id: "00000000-0000-4000-8000-000000000001",
        user: "u1",
        role: "owner",
      }).success,
    ).toBe(true);
    expect(
      householdMemberSchema.safeParse({
        id: "m1",
        household: "h1",
        sync_id: "00000000-0000-4000-8000-000000000001",
        user: "u1",
        role: "admin",
      }).success,
    ).toBe(false);
  });
});
