<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-vue-next";
import { useSyncStore } from "@/stores/sync";
import { describeSyncError } from "@/sync/errors";
import SyncDetailsModal from "./SyncDetailsModal.vue";

const sync = useSyncStore();
const open = ref(false);

const label = computed(() => {
  if (!sync.online) return "Offline";
  if (sync.syncing) return "Sincronizando";
  if (sync.failed > 0) return `${sync.failed} falha(s)`;
  if (sync.pending > 0) return `${sync.pending} pendente(s)`;
  return "Sincronizado";
});

const tooltip = computed(() =>
  sync.failed > 0 ? describeSyncError(sync.lastError) : `Status de sincronização: ${label.value}`,
);

onMounted(() => {
  void sync.refreshStatus();
});
</script>

<template>
  <button
    type="button"
    data-compact
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
    :title="tooltip"
    :class="
      !sync.online
        ? 'border-sun/50 bg-sun/20 text-accent-foreground'
        : sync.failed > 0
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-card text-muted-foreground'
    "
    :aria-label="`Status de sincronização: ${label}. Toque para ver detalhes`"
    @click="open = true"
  >
    <CloudOff v-if="!sync.online" class="h-4 w-4" aria-hidden="true" />
    <RefreshCw v-else-if="sync.syncing" class="h-4 w-4 animate-spin" aria-hidden="true" />
    <TriangleAlert v-else-if="sync.failed > 0" class="h-4 w-4" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>

  <SyncDetailsModal v-model="open" />
</template>
