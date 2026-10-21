<script setup lang="ts">
import { computed } from "vue";
import { formatBRL } from "@/lib/format";

const props = defineProps<{
  items: { name: string; value: number; color: string }[];
  totalCents: number;
  label?: string;
}>();

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const segments = computed(() => {
  const total = props.items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;
  return props.items.map((item) => {
    const fraction = total > 0 ? item.value / total : 0;
    const length = fraction * CIRCUMFERENCE;
    const segment = {
      ...item,
      length: Math.max(0, length - 1.5),
      offset,
    };
    offset += length;
    return segment;
  });
});

const hasData = computed(() => props.totalCents > 0);
</script>

<template>
  <div class="relative mx-auto h-40 w-40 shrink-0" role="img" :aria-label="label ?? 'Gastos por estabelecimento'">
    <svg viewBox="0 0 128 128" class="h-full w-full -rotate-90">
      <circle
        cx="64"
        cy="64"
        :r="RADIUS"
        fill="none"
        stroke="currentColor"
        class="text-muted"
        stroke-width="14"
      />
      <circle
        v-for="segment in segments"
        :key="segment.name"
        cx="64"
        cy="64"
        :r="RADIUS"
        fill="none"
        :stroke="segment.color"
        stroke-width="14"
        stroke-linecap="butt"
        :stroke-dasharray="`${segment.length} ${CIRCUMFERENCE}`"
        :stroke-dashoffset="-segment.offset"
      >
        <title>{{ segment.name }}: {{ formatBRL(segment.value) }}</title>
      </circle>
    </svg>
    <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
      <span class="text-[0.6rem] font-extrabold uppercase tracking-wider text-muted-foreground">
        {{ label ?? "Total" }}
      </span>
      <span class="font-display text-sm font-black">{{ hasData ? formatBRL(totalCents) : "—" }}</span>
    </div>
  </div>
</template>
