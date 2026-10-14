import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db/schema";
import type { SyncableRecord } from "@/db/repositories";
import {
  clearStoredConflicts,
  deleteStoredConflict,
  loadConflicts,
  saveConflicts,
  type ConflictEntry,
} from "@/sync/conflict";

const entry: ConflictEntry = {
  entity: "accounts",
  id: "a1",
  reason: "conflict_kept_server",
  serverRecord: { id: "a1", household: "h1", sync_id: "s1" } as SyncableRecord,
  clientPayload: { id: "a1", name: "Cliente" },
  clientUpdatedAt: "2026-01-01T00:00:00.000Z",
};

describe("conflitos persistidos", () => {
  beforeEach(async () => {
    await db.conflicts.clear();
  });

  it("salva, atualiza, carrega e remove conflitos", async () => {
    await saveConflicts([entry]);
    let list = await loadConflicts();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("a1");
    expect(list[0]?.clientPayload?.name).toBe("Cliente");

    await saveConflicts([{ ...entry, reason: "revisar" }]);
    list = await loadConflicts();
    expect(list).toHaveLength(1);
    expect(list[0]?.reason).toBe("revisar");

    await deleteStoredConflict("accounts", "a1");
    expect(await loadConflicts()).toHaveLength(0);

    await saveConflicts([entry]);
    await clearStoredConflicts();
    expect(await loadConflicts()).toHaveLength(0);
  });
});
