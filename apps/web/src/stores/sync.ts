import { defineStore } from "pinia";
import { ref } from "vue";
import {
  clearStoredConflicts,
  conflictDiff,
  deleteStoredConflict,
  loadConflicts,
  saveConflicts,
  type ConflictEntry,
} from "../sync/conflict";
import {
  countFailed,
  countPending,
  discard as discardOutbox,
  lastError as readLastError,
  listFailed,
  resetStaleSending,
  resetToPending,
} from "../sync/outbox";
import { db, getMeta, setMeta, type OutboxItem } from "../db/schema";
import { clearPendingFlag, ENTITY_TABLES, updateLocal, type SyncableRecord } from "../db/repositories";
import { getCursor, pullChanges, reconcileOrphanInvoices, resetCursor } from "../sync/puller";
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
  let outboxTimer: ReturnType<typeof setTimeout> | null = null;

  function scheduleSync(delayMs = 800): void {
    if (outboxTimer !== null) clearTimeout(outboxTimer);
    outboxTimer = setTimeout(() => {
      outboxTimer = null;
      if (syncing.value) {
        scheduleSync(400);
        return;
      }
      void syncNow();
    }, delayMs);
  }

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
    // Toda alteração local enfileira no outbox e avisa aqui: sobe logo
    // (com debounce), em vez de esperar abrir o app ou sincronizar no botão.
    window.addEventListener("cf:outbox-change", () => {
      if (online.value) scheduleSync();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") void syncNow();
    });
  }

  async function refreshStatus(): Promise<void> {
    pending.value = await countPending();
    failed.value = await countFailed();
    lastError.value = await readLastError();
    failedItems.value = await listFailed();
    conflicts.value = await loadConflicts();
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
      await resetStaleSending();
      const summary = await pushOutbox(household);
      if (summary.conflicts.length > 0) {
        await saveConflicts(summary.conflicts);
      }
      await pullChanges(household);
      // Limpeza única: faturas órfãs (creates que falharam e foram descartados).
      try {
        const cleanupKey = `cleanup:invoice-orphans:${household}`;
        if (!(await getMeta(cleanupKey))) {
          await reconcileOrphanInvoices(household);
          await setMeta(cleanupKey, "1");
        }
      } catch {
        // limpeza é best-effort (não bloqueia o sync)
      }
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

  async function acknowledgeConflict(id: string): Promise<void> {
    const entry = conflicts.value.find((conflict) => conflict.id === id);
    conflicts.value = conflicts.value.filter((conflict) => conflict.id !== id);
    if (entry) await deleteStoredConflict(entry.entity, id);
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
    await acknowledgeConflict(id);
  }

  /** Reaplica a versão local (cliente vence) e registra na auditoria. */
  async function reapplyClient(id: string): Promise<void> {
    const entry = conflicts.value.find((conflict) => conflict.id === id);
    if (!entry?.clientPayload) {
      await acknowledgeConflict(id);
      return;
    }
    const table = ENTITY_TABLES[entry.entity];
    const local = await table.get(entry.id);
    if (!local) {
      await recordConflictAudit(entry, "conflict.reapply_client");
      await acknowledgeConflict(id);
      return;
    }
    const merged = { ...local, ...entry.clientPayload, id: entry.id } as SyncableRecord;
    await updateLocal(entry.entity, merged);
    await recordConflictAudit(entry, "conflict.reapply_client");
    await acknowledgeConflict(id);
    await syncNow();
  }

  async function clearConflicts(): Promise<void> {
    conflicts.value = [];
    await clearStoredConflicts();
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
