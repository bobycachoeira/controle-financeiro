import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import { applyRemote, createLocal, updateLocal, type SyncableRecord } from "@/db/repositories";

function account(id: string, name: string): SyncableRecord & Record<string, unknown> {
  return {
    id,
    household: "h1",
    sync_id: `s-${id}`,
    name,
    type: "corrente",
    currency: "BRL",
    initial_balance_cents: 0,
    include_in_total: true,
    active: true,
    order: 0,
    updated_by: null,
    deleted_at: null,
  };
}

describe("applyRemote com alterações pendentes", () => {
  beforeEach(async () => {
    await db.accounts.clear();
    await db.outbox.clear();
  });

  it("não sobrescreve registro com alteração local ainda não enviada", async () => {
    await createLocal("accounts", account("a1", "Original"));
    await updateLocal("accounts", { ...(await db.accounts.get("a1"))!, name: "Editada" });

    await applyRemote("accounts", account("a1", "Do servidor"));
    expect((await db.accounts.get("a1"))?.name).toBe("Editada");
  });

  it("aplica o estado do servidor quando não há pendência", async () => {
    await createLocal("accounts", account("a1", "Original"));
    await db.accounts.put({ ...(await db.accounts.get("a1"))!, _pendingOutboxId: undefined });
    await db.outbox.clear();

    await applyRemote("accounts", account("a1", "Do servidor"));
    expect((await db.accounts.get("a1"))?.name).toBe("Do servidor");
  });

  it("força a aplicação (resolução de conflito)", async () => {
    await createLocal("accounts", account("a1", "Original"));
    await updateLocal("accounts", { ...(await db.accounts.get("a1"))!, name: "Editada" });

    await applyRemote("accounts", account("a1", "Vencedor do servidor"), { force: true });
    expect((await db.accounts.get("a1"))?.name).toBe("Vencedor do servidor");
  });
});
