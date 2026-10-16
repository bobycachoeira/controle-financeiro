<script setup lang="ts">
import { computed, ref } from "vue";
import { cn } from "@/lib/utils";
import { centsToInput, digitsToCents } from "@/lib/format-input";

const props = withDefaults(
  defineProps<{
    modelValue?: number | null;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    class?: string;
    id?: string;
    ariaLabel?: string;
    autofocus?: boolean;
  }>(),
  {
    modelValue: null,
    placeholder: "0,00",
    required: false,
    disabled: false,
    class: "",
    id: undefined,
    ariaLabel: undefined,
  },
);

const emit = defineEmits<{ "update:modelValue": [number | null] }>();

const input = ref<HTMLInputElement | null>(null);

const display = computed(() => centsToInput(props.modelValue));

function onInput(event: Event): void {
  const el = event.target as HTMLInputElement;
  const cents = digitsToCents(el.value);
  emit("update:modelValue", cents);
  el.value = centsToInput(cents);
}

function focus(): void {
  input.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <input
    :id="id"
    ref="input"
    type="text"
    inputmode="numeric"
    :value="display"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
    :aria-label="ariaLabel"
    :autofocus="autofocus"
    :class="
      cn(
        'flex h-11 w-full rounded-2xl border-2 border-input bg-card px-4 py-2 text-[0.95rem] font-semibold text-foreground shadow-inset transition-colors placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50',
        props.class,
      )
    "
    @input="onInput"
  />
</template>
