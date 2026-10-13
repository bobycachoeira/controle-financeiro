import { defineStore } from "pinia";
import { ref } from "vue";
import { conflictDiff, type ConflictEntry } from "../sync/conflict";
import {
  countFailed,
  countPending,
  discard as discardOutbox,
  lastError as readLastError,
  listFailed,
  resetToPending,
} from "../sync/outbox";
import { db, type OutboxItem } from "../db/schema";
import { clearPendingFlag, ENTITY_TABLES, updateLocal, type SyncableRecord } from "../db/repositories";
import { getCursor, pullChanges, resetCursor } from "../sync/puller";
import { pushOutbox } from "../sync/pusher";
import { auditApi } from "../api/audit-api";
import { useSessionStore } from "./session";

export const useSyncStore = defineStore("sync", () => {
  const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);
  const syncing = ref(false);
  const lastSyncedAt = ref<string | null>(null);
  const pending = ref(0);
  const failed = ref(0);
  const lastError = ref<string | null>(null);
  const conflicts = ref<ConflictEntry[]>([]);
  const failedItems = ref<OutboxItem[]>([]);
  const cursor = ref(0);
  const dataVersion = ref(0);
  let bound = false;

  function bind(): void {
    if (bound || typeof window === "undefined") return;
    bound = true;
    window.addEventListener("online", () => {
      online.value = true;
      void syncNow();
    });
    window.addEventListener("offline", () => {
      online.value = false;
    });
  }

  async function refreshStatus(): Promise<void> {
    pending.value = await countPending();
    failed.value = await countFailed();
    lastError.value = await readLastError();
    failedItems.value = await listFailed();
    const session = useSessionStore();
    if (session.currentHouseholdId) {
      cursor.value = await getCursor(session.currentHouseholdId);
    }
  }

  async function retryItem(id?: number): Promise<void> {
    if (id === undefined) return;
    await resetToPending(id);
    await syncNow();
  }

  async function retryAll(): Promise<void> {
    for (const item of await listFailed()) {
      if (item.id) await resetToPending(item.id);
    }
    await syncNow();
  }

  async function discardItem(id?: number): Promise<void> {
    if (id === undefined) return;
    const item = await db.outbox.get(id);
    if (item?.entity_id) {
      await clearPendingFlag(item.entity, item.entity_id);
    }
    await discardOutbox(id);
    await refreshStatus();
  }

  async function syncNow(): Promise<void> {
    bind();
    const session = useSessionStore();
    const household = session.currentHouseholdId;
    if (!household || !online.value || syncing.value) return;
    syncing.value = true;
    try {
      const summary = await pushOutbox(household);
      if (summary.conflicts.length > 0) {
        conflicts.value = [...conflicts.value, ...summary.conflicts];
      }
      await pullChanges(household);
      cursor.value = await getCursor(household);
      lastSyncedAt.value = new Date().toISOString();
      lastError.value = null;
      dataVersion.value += 1;
    } catch (error) {
      lastError.value = error instanceof Error ? error.message : String(error);
    } finally {
      syncing.value = false;
      await refreshStatus();
    }
  }

  function acknowledgeConflict(id: string): void {
    conflicts.value = conflicts.value.filter((conflict) => conflict.id !== id);
  }

  async function recordConflictAudit(entry: ConflictEntry, action: string): Promise<void> {
    const session = useSessionStore();
    const diffs = conflictDiff(entry);
    const before: Record<string, unknown> = {};
    for (const diff of diffs) {
      before[diff.field] = { client: diff.client, server: diff.server };
    }
    try {
      await auditApi.record({
        household: session.currentHouseholdId ?? undefined,
        action,
        entity: entry.entity,
        entity_id: entry.id,
        before,
        after: { winner: action === "conflict.reapply_client" ? "client" : "server" },
      });
    } catch {
      // auditoria é best-effort (não bloqueia a resolução)
    }
  }

  /** Mantém a versão do servidor (descarta a local) e registra na auditoria. */
  async function keepServer(id: string): Promise<void> {
    const entry = conflicts.value.find((conflict) => conflict.id === id);
    if (entry) await recordConflictAudit(entry, "conflict.keep_server");
    acknowledgeConflict(id);
  }

  /** Reaplica a versão local (cliente vence) e registra na auditoria. */
  async function reapplyClient(id: string): Promise<void> {
    const entry = conflicts.value.find((conflict) => conflict.id === id);
    if (!entry?.clientPayload) {
      acknowledgeConflict(id);
      return;
    }
    const table = ENTITY_TABLES[entry.entity];
    const local = await table.get(entry.id);
    if (!local) {
      await recordConflictAudit(entry, "conflict.reapply_client");
      acknowledgeConflict(id);
      return;
    }
    const merged = { ...local, ...entry.clientPayload, id: entry.id } as SyncableRecord;
    await updateLocal(entry.entity, merged);
    await recordConflictAudit(entry, "conflict.reapply_client");
    acknowledgeConflict(id);
    await syncNow();
  }

  function clearConflicts(): void {
    conflicts.value = [];
  }

  async function fullResync(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    await resetCursor(session.currentHouseholdId);
    await syncNow();
  }

  return {
    online,
    syncing,
    lastSyncedAt,
    pending,
    failed,
    lastError,
    conflicts,
    failedItems,
    cursor,
    dataVersion,
    bind,
    refreshStatus,
    syncNow,
    retryItem,
    retryAll,
    discardItem,
    acknowledgeConflict,
    keepServer,
    reapplyClient,
    clearConflicts,
    fullResync,
  };
});
