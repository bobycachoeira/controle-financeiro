<script setup lang="ts">
import { cn } from "@/lib/utils";
defineProps<{ for?: string; class?: string }>();
</script>

<template>
  <label
    :for="$props.for"
    :class="cn('text-[0.7rem] font-extrabold uppercase tracking-wider text-muted-foreground', $props.class)"
  >
    <slot />
  </label>
</template>
