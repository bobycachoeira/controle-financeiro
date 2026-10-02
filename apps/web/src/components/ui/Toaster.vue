<script setup lang="ts">
import { useToast } from "@/composables/useToast";
import { cn } from "@/lib/utils";

const { toasts, dismiss } = useToast();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
    aria-live="polite"
    role="status"
  >
    <div
      v-for="toast in toasts"
      :key="toast.id"
      :class="
        cn(
          'pointer-events-auto w-full max-w-sm rounded-md border px-4 py-3 text-sm shadow-lg',
          toast.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
          toast.kind === 'error' && 'border-red-200 bg-red-50 text-red-900',
          toast.kind === 'info' && 'border-slate-200 bg-white text-slate-900',
        )
      "
      @click="dismiss(toast.id)"
    >
      {{ toast.message }}
    </div>
  </div>
</template>
