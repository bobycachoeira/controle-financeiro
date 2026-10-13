<script setup lang="ts">
import { isLoading } from "@/lib/loading";
</script>

<template>
  <div
    v-if="isLoading"
    class="fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-primary/15"
    role="progressbar"
    aria-label="Carregando"
  >
    <div
      class="h-full w-1/3 animate-[loadingbar_1.1s_ease-in-out_infinite] bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.7)]"
    />
  </div>
</template>

<style>
@keyframes loadingbar {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(320%);
  }
}
</style>
