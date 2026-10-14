import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useBudgetsStore } from "@/stores/budgets";
import { useRecurrencesStore } from "@/stores/recurrences";
import { createLocal, newSyncId } from "@/db/repositories";

describe("budgets store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.budgets.clear();
    await db.transactions.clear();
    const session = useSessionStore();
    session.setHousehold("h1");
  });

  it("creates a budget and computes usage from local transactions", async () => {
    const store = useBudgetsStore();
    const budget = await store.create({
      name: "Alimentação",
      period: "mensal",
      total_cents: 100000,
      alert_pct: 80,
      reference_month: "2024-03",
      categories: [{ category: "food" }],
    });

    await createLocal("transactions", {
      id: "t1",
      household: "h1",
      sync_id: newSyncId(),
      account: "a1",
      credit_card: null,
      amount_cents: 90000,
      currency: "BRL",
      type: "despesa",
      date: "2024-03-10",
      attribution: "meu",
      status: "pago",
      category: "food",
      description: "",
      tags: [],
      note: "",
      deleted_at: null,
    });

    const usage = await store.usageFor(budget);
    expect(usage.spentCents).toBe(90000);
    expect(usage.percent).toBe(90);
    expect(usage.status).toBe("alerta");
  });

  it("computes history across the last periods", async () => {
    const store = useBudgetsStore();
    const budget = await store.create({
      name: "Alimentação",
      period: "mensal",
      total_cents: 100000,
      alert_pct: 80,
      reference_month: "2024-03",
      categories: [{ category: "food" }],
    });

    await createLocal("transactions", {
      id: "th1",
      household: "h1",
      sync_id: newSyncId(),
      account: "a1",
      credit_card: null,
      amount_cents: 50000,
      currency: "BRL",
      type: "despesa",
      date: "2024-02-10",
      attribution: "meu",
      status: "pago",
      category: "food",
      description: "",
      tags: [],
      note: "",
      deleted_at: null,
    });

    const history = await store.historyFor(budget);
    expect(history.map((entry) => entry.month)).toEqual([
      "2023-10",
      "2023-11",
      "2023-12",
      "2024-01",
      "2024-02",
      "2024-03",
    ]);
    expect(history[4]?.usage.spentCents).toBe(50000);
    expect(history[5]?.usage.spentCents).toBe(0);
  });
});

describe("recurrences store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.recurrences.clear();
    const session = useSessionStore();
    session.setHousehold("h1");
  });

  it("creates and lists recurrences", async () => {
    const store = useRecurrencesStore();
    await store.create({
      name: "Aluguel",
      rrule: "FREQ=MONTHLY;INTERVAL=1",
      start_date: "2024-01-05",
      target: "transaction",
      creates_status: "a_pagar",
      template: { amount_cents: 100000, type: "despesa", attribution: "ambos", description: "Aluguel" },
    });
    await store.load();
    expect(store.items).toHaveLength(1);
    expect(store.items[0]?.name).toBe("Aluguel");
  });

  it("pauses a recurrence", async () => {
    const store = useRecurrencesStore();
    const created = await store.create({
      name: "Internet",
      rrule: "FREQ=MONTHLY;INTERVAL=1",
      start_date: "2024-02-10",
      target: "bill",
      creates_status: "a_pagar",
      template: { amount_cents: 12000, type: "despesa", nature: "saida", attribution: "ambos", description: "Internet" },
    });
    await store.setActive(created.id, false);
    expect(store.items[0]?.active).toBe(false);
  });
});
