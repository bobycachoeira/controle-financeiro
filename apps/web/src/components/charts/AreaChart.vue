<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    points: { label: string; value: number }[];
    color?: string;
  }>(),
  { color: "#E4572E" },
);

const W = 320;
const H = 110;
const PAD = 10;
const gradId = `grad-${Math.random().toString(36).slice(2, 8)}`;

const bounds = computed(() => {
  const values = props.points.map((point) => point.value);
  const min = Math.min(0, ...values);
  const max = Math.max(1, ...values);
  return { min, max: max === min ? min + 1 : max };
});

const coords = computed(() => {
  const total = props.points.length;
  const { min, max } = bounds.value;
  const span = max - min || 1;
  return props.points.map((point, index) => {
    const x = total <= 1 ? W / 2 : PAD + (index * (W - PAD * 2)) / (total - 1);
    const y = H - PAD - ((point.value - min) / span) * (H - PAD * 2);
    return { x, y, ...point };
  });
});

const linePath = computed(() =>
  coords.value.map((c, i) => `${i === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" "),
);

const areaPath = computed(() => {
  const first = coords.value[0];
  const last = coords.value[coords.value.length - 1];
  if (!first || !last) return "";
  return `${linePath.value} L${last.x.toFixed(1)},${H - PAD} L${first.x.toFixed(1)},${H - PAD} Z`;
});

const baselineY = computed(() => {
  const { min, max } = bounds.value;
  return H - PAD - ((0 - min) / (max - min || 1)) * (H - PAD * 2);
});
</script>

<template>
  <div>
    <svg :viewBox="`0 0 ${W} ${H}`" class="h-28 w-full" preserveAspectRatio="none" role="img">
      <defs>
        <linearGradient :id="gradId" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.35" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>
      <line
        :x1="0"
        :y1="baselineY"
        :x2="W"
        :y2="baselineY"
        stroke="currentColor"
        class="text-border"
        stroke-dasharray="3 4"
        vector-effect="non-scaling-stroke"
      />
      <path :d="areaPath" :fill="`url(#${gradId})`" />
      <path
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
      <circle
        v-for="(c, i) in coords"
        :key="i"
        :cx="c.x"
        :cy="c.y"
        r="2.4"
        :fill="color"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <div class="mt-1 flex justify-between text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
      <span v-for="point in points" :key="point.label">{{ point.label }}</span>
    </div>
  </div>
</template>
