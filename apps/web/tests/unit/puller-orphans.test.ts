import { beforeEach, describe, expect, it, vi } from "vitest";
import { db, type LocalInvoice } from "@/db/schema";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { get } }));

function invoice(id: string, partial: Partial<LocalInvoice> = {}): LocalInvoice {
  return {
    id,
    household: "h1",
    sync_id: `s-${id}`,
    credit_card: "card1",
    account: "acc1",
    reference_month: "2026-10",
    closing_date: "2026-10-04",
    due_date: "2026-10-11",
    total_cents: 0,
    paid_cents: 0,
    status: "vencida",
    closed_at: null,
    paid_at: null,
    note: "",
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

describe("reconcileOrphanInvoices", () => {
  beforeEach(async () => {
    await db.invoices.clear();
    get.mockReset();
  });

  it("remove faturas locais que não existem no servidor (sem outbox pendente)", async () => {
    await db.invoices.bulkPut([
      invoice("server1"),
      invoice("orphan", { reference_month: "2026-09" }),
      invoice("pending", { _pendingOutboxId: 42 }),
    ]);
    get.mockResolvedValue({
      server_seq: 10,
      has_more: false,
      changes: [{ entity: "invoices", id: "server1", seq: 10, deleted: false, record: null }],
    });

    const { reconcileOrphanInvoices } = await import("@/sync/puller");
    const removed = await reconcileOrphanInvoices("h1");

    expect(removed).toBe(1);
    expect(await db.invoices.get("server1")).toBeDefined();
    expect(await db.invoices.get("orphan")).toBeUndefined();
    expect(await db.invoices.get("pending")).toBeDefined();
  });
});
