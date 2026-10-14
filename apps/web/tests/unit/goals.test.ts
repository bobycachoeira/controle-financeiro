import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { goalProgress } from "@cf/shared";
import { db } from "@/db/schema";
import { useGoalsStore } from "@/stores/goals";
import { useSessionStore } from "@/stores/session";

describe("goals store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.goals.clear();
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
});
