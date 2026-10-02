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
        'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground',
        props.class,
      )
    "
    @input="onInput"
  />
</template>
