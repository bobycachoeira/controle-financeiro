<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue?: string | number | null;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  autocomplete?: string;
  inputmode?: "text" | "numeric" | "decimal" | "email" | "tel";
  class?: string;
  id?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  ariaLabel?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [string] }>();

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLInputElement).value);
}
</script>

<template>
  <input
    :id="id"
    :type="type ?? 'text'"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
    :autocomplete="autocomplete"
    :inputmode="inputmode"
    :min="min"
    :max="max"
    :step="step"
    :aria-label="ariaLabel"
    :class="
      cn(
        'flex h-11 w-full rounded-2xl border-2 border-input bg-card px-4 py-2 text-[0.95rem] font-semibold text-foreground shadow-inset transition-colors placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @input="onInput"
  />
</template>
