<script setup lang="ts">
import { computed } from "vue";
import { CloudOff, RefreshCw, RotateCw, Trash2 } from "lucide-vue-next";
import { useSyncStore } from "@/stores/sync";
import { describeSyncError, entityLabel, operationLabel } from "@/sync/errors";
import { formatRelative } from "@/lib/format";
import Modal from "@/components/ui/Modal.vue";
import Button from "@/components/ui/Button.vue";
import Badge from "@/components/ui/Badge.vue";

defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const sync = useSyncStore();
const lastErrorText = computed(() => describeSyncError(sync.lastError));
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Sincronização"
    description="Status e itens que não conseguiram ser enviados."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-2xl bg-muted px-2 py-3">
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Conexão</p>
          <p class="mt-1 text-sm font-extrabold" :class="sync.online ? 'text-leaf' : 'text-primary'">
            {{ sync.online ? "Online" : "Offline" }}
          </p>
        </div>
        <div class="rounded-2xl bg-muted px-2 py-3">
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Pendentes</p>
          <p class="mt-1 text-sm font-extrabold">{{ sync.pending }}</p>
        </div>
        <div class="rounded-2xl bg-muted px-2 py-3">
          <p class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">Falhas</p>
          <p class="mt-1 text-sm font-extrabold" :class="sync.failed > 0 ? 'text-destructive' : ''">
            {{ sync.failed }}
          </p>
        </div>
      </div>

      <p v-if="sync.lastSyncedAt" class="text-center text-xs font-semibold text-muted-foreground">
        Última sincronização {{ formatRelative(sync.lastSyncedAt) }}
      </p>

      <div v-if="!sync.online" class="flex items-center gap-2 rounded-2xl bg-sun/25 px-3 py-2 text-sm font-bold text-accent-foreground">
        <CloudOff class="h-4 w-4" />
        Você está offline. Os itens serão enviados quando a conexão voltar.
      </div>

      <div v-else-if="sync.failed > 0" class="space-y-2">
        <p class="text-sm font-bold text-destructive">{{ lastErrorText }}</p>
        <ul class="space-y-2">
          <li
            v-for="item in sync.failedItems"
            :key="item.id"
            class="rounded-2xl border-2 border-border p-3"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold">
                {{ entityLabel(item.entity) }}
                <span class="font-semibold text-muted-foreground">· {{ operationLabel(item.operation) }}</span>
              </span>
              <Badge variant="destructive">{{ item.attempts }} tentativa(s)</Badge>
            </div>
            <p class="mt-1 text-xs font-semibold text-muted-foreground">
              {{ describeSyncError(item.last_error) }}
            </p>
            <div class="mt-2 flex gap-2">
              <Button v-if="item.id" size="sm" variant="secondary" @click="sync.retryItem(item.id)">
                <RotateCw class="h-3.5 w-3.5" /> Tentar
              </Button>
              <Button v-if="item.id" size="sm" variant="ghost" @click="sync.discardItem(item.id)">
                <Trash2 class="h-3.5 w-3.5" /> Descartar
              </Button>
            </div>
          </li>
        </ul>
      </div>

      <p v-else class="rounded-2xl bg-leaf/10 px-3 py-3 text-center text-sm font-bold text-leaf">
        Tudo sincronizado. Nenhuma falha.
      </p>

      <div class="flex justify-end gap-2 pt-1">
        <Button
          v-if="sync.failed > 0"
          variant="outline"
          :disabled="!sync.online || sync.syncing"
          @click="sync.retryAll()"
        >
          Tentar todas
        </Button>
        <Button :loading="sync.syncing" :disabled="!sync.online" @click="sync.syncNow()">
          <RefreshCw class="h-4 w-4" /> Sincronizar agora
        </Button>
      </div>
    </div>
  </Modal>
</template>
