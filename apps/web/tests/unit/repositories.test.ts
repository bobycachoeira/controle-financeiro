import { beforeEach, describe, expect, it } from "vitest";
import { reactive } from "vue";
import { db } from "@/db/schema";
import { createLocal, updateLocal } from "@/db/repositories";

describe("repositories with reactive records", () => {
  beforeEach(async () => {
    await db.accounts.clear();
    await db.outbox.clear();
  });

  it("persists reactive (Proxy) records without DataCloneError", async () => {
    const record = reactive({
      id: "a1",
      household: "h1",
      sync_id: "11111111-1111-4111-8111-111111111111",
      name: "Corrente",
      type: "corrente",
      currency: "BRL",
      initial_balance_cents: 0,
      include_in_total: true,
      active: true,
      order: 0,
      color: null,
      icon: null,
      nested: { deep: { value: 1 } },
      updated_by: null,
      deleted_at: null,
    });

    await expect(createLocal("accounts", record)).resolves.toBeDefined();

    record.name = "Atualizada";
    record.nested.deep.value = 2;
    await expect(updateLocal("accounts", record)).resolves.toBeDefined();

    const stored = await db.accounts.get("a1");
    expect(stored?.name).toBe("Atualizada");
    expect((stored as unknown as { nested: { deep: { value: number } } }).nested.deep.value).toBe(2);
  });
});
