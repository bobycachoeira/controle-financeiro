import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useRatesStore } from "@/stores/rates";

describe("rates store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.exchange_rates.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
  });

  it("atualiza a cotação existente em vez de duplicar", async () => {
    const store = useRatesStore();
    await store.create({ currency: "USD", date: "2026-11-27", rate_micros: 5600000 });
    await store.create({ currency: "USD", date: "2026-11-27", rate_micros: 5535300 });

    const rates = await db.exchange_rates.toArray();
    expect(rates).toHaveLength(1);
    expect(rates[0]?.rate_micros).toBe(5535300);

    const outbox = await db.outbox.toArray();
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.operation).toBe("create");
    expect((outbox[0]?.payload as { rate_micros: number }).rate_micros).toBe(5535300);
  });
});
