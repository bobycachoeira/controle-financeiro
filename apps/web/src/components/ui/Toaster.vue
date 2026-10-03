<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info } from "lucide-vue-next";
import { useToast } from "@/composables/useToast";
import { cn } from "@/lib/utils";

const { toasts, dismiss } = useToast();
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-0 top-[4.75rem] z-[60] flex flex-col items-center gap-2 px-4 sm:top-20"
    aria-live="polite"
    role="status"
  >
    <TransitionGroup
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="-translate-y-3 opacity-0"
      leave-active-class="transition duration-200 ease-in"
      leave-to-class="-translate-y-2 opacity-0"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="
          cn(
            'pointer-events-auto flex w-full max-w-sm animate-pop items-center gap-3 rounded-2xl border-2 px-4 py-3 text-sm font-semibold shadow-lift',
            toast.kind === 'success' && 'border-leaf/30 bg-card text-leaf',
            toast.kind === 'error' && 'border-destructive/30 bg-card text-destructive',
            toast.kind === 'info' && 'border-border bg-card text-foreground',
          )
        "
        role="button"
        tabindex="0"
        @click="dismiss(toast.id)"
        @keydown.enter="dismiss(toast.id)"
      >
        <CheckCircle2 v-if="toast.kind === 'success'" class="h-5 w-5 shrink-0" aria-hidden="true" />
        <AlertCircle v-else-if="toast.kind === 'error'" class="h-5 w-5 shrink-0" aria-hidden="true" />
        <Info v-else class="h-5 w-5 shrink-0" aria-hidden="true" />
        <span class="flex-1">{{ toast.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
