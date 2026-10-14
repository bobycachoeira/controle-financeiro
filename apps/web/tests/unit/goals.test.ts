import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { goalProgress } from "@cf/shared";
import { db } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { useGoalsStore } from "@/stores/goals";
import { useSessionStore } from "@/stores/session";

describe("goals store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.goals.clear();
    await db.accounts.clear();
    await db.transfers.clear();
    await db.transactions.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("cria meta, guarda e resgata valores", async () => {
    const store = useGoalsStore();
    const goal = await store.create({ name: "Viagem", target_cents: 100000 });

    await store.addEntry(goal.id, 30000, "Primeiro aporte", "2026-10-10");
    await store.addEntry(goal.id, 20000);
    await store.addEntry(goal.id, -5000, "Imprevisto");

    const stored = await db.goals.get(goal.id);
    const progress = goalProgress(stored?.target_cents ?? 0, stored?.entries ?? []);
    expect(progress.savedCents).toBe(45000);
    expect(progress.remainingCents).toBe(55000);
    expect(stored?.entries).toHaveLength(3);
    expect(stored?.entries[0]?.note).toBe("Primeiro aporte");

    // alterações enfileiradas no outbox (sync)
    expect(await db.outbox.count()).toBeGreaterThan(0);
  });

  it("move o dinheiro de/para uma conta através do cofrinho", async () => {
    const goalsStore = useGoalsStore();
    const accountsStore = useAccountsStore();
    const account = await accountsStore.create({
      name: "Conta Teste",
      type: "corrente",
      initial_balance_cents: 100000,
    });
    const goal = await goalsStore.create({ name: "Reserva", target_cents: 50000 });

    await goalsStore.addEntry(goal.id, 30000, "Aporte", "2026-10-10", account.id);
    let stored = await db.goals.get(goal.id);
    const cofrinhoId = stored?.cofrinho_account ?? "";
    expect(cofrinhoId).toBeTruthy();
    const cofrinho = await db.accounts.get(cofrinhoId);
    expect(cofrinho?.name).toContain("Cofrinho");
    expect(await goalsStore.cofrinhoBalance(stored!)).toBe(30000);
    expect(await db.transfers.where("household").equals("h1").count()).toBe(1);
    expect((await db.transfers.toArray())[0]?.source_account).toBe(account.id);

    await goalsStore.addEntry(goal.id, -10000, "Resgate", "2026-10-11", account.id);
    stored = await db.goals.get(goal.id);
    expect(await goalsStore.cofrinhoBalance(stored!)).toBe(20000);
    expect(await db.transfers.where("household").equals("h1").count()).toBe(2);

    // Não deixa excluir a meta com dinheiro no cofrinho.
    await expect(goalsStore.remove(goal.id)).rejects.toThrow(/cofrinho/i);

    await goalsStore.addEntry(goal.id, -20000, "Resgate total", "2026-10-12", account.id);
    await expect(goalsStore.remove(goal.id)).resolves.toBeUndefined();
    expect(goalsStore.items).toHaveLength(0);
  });
});
