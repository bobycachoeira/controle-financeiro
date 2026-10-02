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
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @change="onChange"
  >
    <slot />
  </select>
</template>
