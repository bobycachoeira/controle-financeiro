<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue?: string | number | null;
  id?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [string] }>();

function onChange(event: Event): void {
  emit("update:modelValue", (event.target as HTMLSelectElement).value);
}
</script>

<template>
  <select
    :id="id"
    :value="modelValue ?? ''"
    :required="required"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :class="
      cn(
        'flex h-11 w-full appearance-none rounded-2xl border-2 border-input bg-card bg-[length:1rem] bg-[right_0.9rem_center] bg-no-repeat px-4 pr-10 text-[0.95rem] font-semibold text-foreground shadow-inset transition-colors focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    style="background-image: url(&quot;data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23566' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E&quot;)"
    @change="onChange"
  >
    <slot />
  </select>
</template>
