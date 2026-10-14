import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { todayISO } from "@cf/shared";
import { db } from "@/db/schema";
import { seedSampleData } from "@/lib/sample-data";
import { useSessionStore } from "@/stores/session";

describe("dados de exemplo", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.accounts.clear();
    await db.transactions.clear();
    await db.categories.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("cria contas e lançamentos no mês corrente", async () => {
    const result = await seedSampleData();
    expect(result.accounts).toBe(2);
    expect(result.transactions).toBeGreaterThanOrEqual(4);

    const accounts = await db.accounts.where("household").equals("h1").toArray();
    expect(accounts.map((account) => account.name)).toContain("Conta do dia a dia");

    const month = todayISO().slice(0, 7);
    const transactions = await db.transactions.where("household").equals("h1").toArray();
    expect(transactions.some((tx) => tx.type === "receita" && tx.description === "Salário")).toBe(
      true,
    );
    expect(transactions.every((tx) => tx.date.startsWith(month))).toBe(true);
    expect(transactions.some((tx) => tx.status === "a_pagar")).toBe(true);
    expect(await db.outbox.count()).toBeGreaterThan(0);
  });
});
