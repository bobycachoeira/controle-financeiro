import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/schema";
import { createLocal } from "@/db/repositories";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/api/client", () => ({ apiClient: { post } }));

function invoiceRecord(id: string) {
  return {
    id,
    household: "h1",
    sync_id: `sync-${id}`,
    credit_card: "card1",
    account: "acc1",
    reference_month: "2026-10",
    closing_date: "2026-10-06",
    due_date: "2026-10-17",
    total_cents: 0,
    paid_cents: 0,
    status: "fechada" as const,
    closed_at: null,
    paid_at: null,
    note: "",
    updated_by: null,
    deleted_at: null,
  };
}

describe("pusher: create duplicado de fatura", () => {
  beforeEach(async () => {
    await db.invoices.clear();
    await db.outbox.clear();
    post.mockReset();
  });

  it("substitui a cópia local pela fatura que já existia no servidor", async () => {
    const local = await createLocal("invoices", invoiceRecord("localduplicate1"));
    const item = (await db.outbox.toArray())[0]!;
    post.mockResolvedValue({
      server_seq: 123,
      results: [
        {
          sync_id: item.sync_id,
          entity: "invoices",
          status: "applied",
          code: "duplicate_merged",
          remote_id: "serverinvoice01",
          record: { ...invoiceRecord("serverinvoice01"), sync_id: "sync-server" },
        },
      ],
    });

    const { pushOutbox } = await import("@/sync/pusher");
    const summary = await pushOutbox("h1");

    expect(summary.applied).toBe(1);
    expect(await db.invoices.get(local.id)).toBeUndefined();
    expect((await db.invoices.get("serverinvoice01"))?.status).toBe("fechada");
    expect((await db.outbox.get(item.id!))?.status).toBe("done");
  });

  it("remove a cópia local quando o registro do servidor está excluído", async () => {
    const local = await createLocal("invoices", invoiceRecord("localduplicate2"));
    const item = (await db.outbox.toArray())[0]!;
    post.mockResolvedValue({
      server_seq: 124,
      results: [
        {
          sync_id: item.sync_id,
          entity: "invoices",
          status: "applied",
          code: "duplicate_merged",
          remote_id: "serverinvoice02",
          record: {
            ...invoiceRecord("serverinvoice02"),
            deleted_at: "2026-10-13T18:00:00.000Z",
          },
        },
      ],
    });

    const { pushOutbox } = await import("@/sync/pusher");
    await pushOutbox("h1");

    expect(await db.invoices.get(local.id)).toBeUndefined();
    expect(await db.invoices.get("serverinvoice02")).toBeUndefined();
  });
});
