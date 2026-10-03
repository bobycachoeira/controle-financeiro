<script setup lang="ts">
import { useRegisterSW } from "virtual:pwa-register/vue";

const { needRefresh, updateServiceWorker } = useRegisterSW();

function update(): void {
  void updateServiceWorker(true);
}

function dismiss(): void {
  needRefresh.value = false;
}
</script>

<template>
  <div
    v-if="needRefresh"
    class="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 bg-primary px-4 py-2 text-sm text-primary-foreground"
    role="status"
    aria-live="polite"
  >
    <span>Nova versão disponível.</span>
    <span class="flex gap-2">
      <button class="rounded bg-white/20 px-3 py-1" @click="update">Atualizar agora</button>
      <button class="rounded px-3 py-1 underline" @click="dismiss">Depois</button>
    </span>
  </div>
</template>
