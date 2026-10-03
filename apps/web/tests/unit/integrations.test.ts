import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useImportStore } from "@/stores/import";
import { useRatesStore, parseRateToMicros } from "@/stores/rates";
import { selectConsolidatedBalance } from "@/features/dashboard/selectors";
import { createLocal, newSyncId } from "@/db/repositories";

describe("rate parsing", () => {
  it("parses pt-BR rates to micros", () => {
    expect(parseRateToMicros("5,20")).toBe(5_200_000);
    expect(parseRateToMicros("5.20")).toBe(5_200_000);
    expect(parseRateToMicros("0")).toBeNull();
    expect(parseRateToMicros("abc")).toBeNull();
  });
});

describe("import store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    await db.categories.clear();
    const session = useSessionStore();
    session.setHousehold("h1");
  });

  it("imports CSV rows and skips duplicates on re-import", async () => {
    const store = useImportStore();
    const csv = "data;valor;descrição\n01/03/2024;-10,50;Mercado\n05/03/2024;1.500,00;Salário";
    const preview = store.parse(csv);
    expect(preview.validCount).toBe(2);

    const first = await store.confirm("a1", null);
    expect(first).toBe(2);

    store.parse(csv);
    const second = await store.confirm("a1", null);
    expect(second).toBe(0);
  });
});

describe("consolidated balance", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.exchange_rates.clear();
    await db.accounts.clear();
    await db.transactions.clear();
    const session = useSessionStore();
    session.setHousehold("h1");
  });

  it("consolidates foreign currency accounts into BRL", async () => {
    await createLocal("accounts", {
      id: "a1",
      household: "h1",
      sync_id: newSyncId(),
      name: "USD",
      type: "corrente",
      currency: "USD",
      initial_balance_cents: 1000,
      include_in_total: true,
      active: true,
      order: 0,
      deleted_at: null,
    });
    const result = selectConsolidatedBalance(
      [{ id: "a1", household: "h1", sync_id: "s", name: "USD", type: "corrente", currency: "USD", initial_balance_cents: 1000, include_in_total: true, active: true, order: 0, deleted_at: null }],
      [],
      [{ currency: "USD", date: "2024-03-01", rate_micros: 5_200_000 }],
      "2024-03-10",
    );
    expect(result.totalCents).toBe(5200);
    expect(result.missing).toEqual([]);
  });
});

describe("rates store", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.exchange_rates.clear();
    const session = useSessionStore();
    session.setHousehold("h1");
  });

  it("creates and lists rates", async () => {
    const store = useRatesStore();
    await store.create({ currency: "usd", date: "2024-03-01", rate_micros: 5_200_000 });
    await store.load();
    expect(store.items[0]?.currency).toBe("USD");
  });
});
