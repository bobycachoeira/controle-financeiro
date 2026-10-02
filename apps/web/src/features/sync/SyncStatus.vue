<script setup lang="ts">
import { computed } from "vue";
import { CloudOff, RefreshCw, TriangleAlert } from "lucide-vue-next";
import { useSyncStore } from "@/stores/sync";

const sync = useSyncStore();

const label = computed(() => {
  if (!sync.online) return "Offline";
  if (sync.syncing) return "Sincronizando";
  if (sync.failed > 0) return `${sync.failed} falha(s)`;
  if (sync.pending > 0) return `${sync.pending} pendente(s)`;
  return "Sincronizado";
});
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs"
    :class="
      !sync.online
        ? 'border-amber-300 bg-amber-50 text-amber-800'
        : sync.failed > 0
          ? 'border-red-300 bg-red-50 text-red-800'
          : 'border-slate-200 bg-slate-50 text-slate-700'
    "
    :aria-label="`Status de sincronização: ${label}`"
    :disabled="sync.syncing || !sync.online"
    @click="sync.syncNow()"
  >
    <CloudOff v-if="!sync.online" class="h-4 w-4" aria-hidden="true" />
    <RefreshCw v-else-if="sync.syncing" class="h-4 w-4 animate-spin" aria-hidden="true" />
    <TriangleAlert v-else-if="sync.failed > 0" class="h-4 w-4" aria-hidden="true" />
    <span>{{ label }}</span>
  </button>
</template>
