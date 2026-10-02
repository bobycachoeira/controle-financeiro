import { defineStore } from "pinia";
import { ref } from "vue";
import type { ConflictEntry } from "../sync/conflict";
import { countFailed, countPending, lastError as readLastError } from "../sync/outbox";
import { getCursor, pullChanges, resetCursor } from "../sync/puller";
import { pushOutbox } from "../sync/pusher";
import { useSessionStore } from "./session";

export const useSyncStore = defineStore("sync", () => {
  const online = ref(typeof navigator === "undefined" ? true : navigator.onLine);
  const syncing = ref(false);
  const lastSyncedAt = ref<string | null>(null);
  const pending = ref(0);
  const failed = ref(0);
  const lastError = ref<string | null>(null);
  const conflicts = ref<ConflictEntry[]>([]);
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
    const session = useSessionStore();
    if (session.currentHouseholdId) {
      cursor.value = await getCursor(session.currentHouseholdId);
    }
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
    cursor,
    dataVersion,
    bind,
    refreshStatus,
    syncNow,
    acknowledgeConflict,
    clearConflicts,
    fullResync,
  };
});
