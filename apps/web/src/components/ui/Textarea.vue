<script setup lang="ts">
import { cn } from "@/lib/utils";

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  rows?: number;
  id?: string;
  class?: string;
}>();

const emit = defineEmits<{ "update:modelValue": [string] }>();

function onInput(event: Event): void {
  emit("update:modelValue", (event.target as HTMLTextAreaElement).value);
}
</script>

<template>
  <textarea
    :id="id"
    :value="modelValue ?? ''"
    :placeholder="placeholder"
    :rows="rows ?? 3"
    :class="
      cn(
        'flex w-full rounded-2xl border-2 border-input bg-card px-4 py-3 text-[0.95rem] font-semibold text-foreground shadow-inset transition-colors placeholder:font-medium placeholder:text-muted-foreground/70 focus-visible:border-primary',
        props.class,
      )
    "
    @input="onInput"
  />
</template>
