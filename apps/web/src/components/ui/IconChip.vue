<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";
import { colorForKey, resolveIcon } from "@/lib/icons";

const props = withDefaults(
  defineProps<{
    name?: string | null;
    color?: string | null;
    seed?: string;
    size?: "sm" | "md" | "lg";
    class?: string;
  }>(),
  { name: null, color: null, seed: "", size: "md", class: "" },
);

const tint = computed(() => props.color || colorForKey(props.seed || props.name || "x"));
const icon = computed(() => resolveIcon(props.name));

const sizes = {
  sm: "h-7 w-7 [&>svg]:h-3.5 [&>svg]:w-3.5",
  md: "h-10 w-10 [&>svg]:h-5 [&>svg]:w-5",
  lg: "h-12 w-12 [&>svg]:h-6 [&>svg]:w-6",
};
</script>

<template>
  <span
    class="chip-glow grid shrink-0 place-items-center rounded-2xl"
    :class="cn(sizes[props.size], props.class)"
    :style="{ backgroundColor: `${tint}1f`, color: tint }"
    aria-hidden="true"
  >
    <component :is="icon" />
  </span>
</template>
