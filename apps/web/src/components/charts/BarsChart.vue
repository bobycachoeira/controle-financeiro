<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  categories: string[];
  series: { label: string; color: string; values: number[] }[];
}>();

const maxValue = computed(() => {
  const values = props.series.flatMap((serie) => serie.values);
  return Math.max(1, ...values);
});

function height(value: number): string {
  return `${Math.max(value > 0 ? 6 : 0, (value / maxValue.value) * 100)}%`;
}
</script>

<template>
  <div>
    <div class="flex items-end gap-3" style="height: 120px">
      <div
        v-for="(category, index) in categories"
        :key="category"
        class="flex flex-1 items-end justify-center gap-1"
        style="height: 100%"
      >
        <div
          v-for="serie in series"
          :key="serie.label"
          class="w-3 rounded-t-md transition-all duration-500"
          :style="{ height: height(serie.values[index] ?? 0), backgroundColor: serie.color }"
          :title="`${serie.label}: ${serie.values[index] ?? 0}`"
        />
      </div>
    </div>
    <div class="mt-1 flex gap-3 text-[0.6rem] font-bold uppercase tracking-wide text-muted-foreground">
      <span v-for="category in categories" :key="category" class="flex-1 text-center">{{ category }}</span>
    </div>
    <div class="mt-2 flex justify-center gap-4">
      <span
        v-for="serie in series"
        :key="serie.label"
        class="flex items-center gap-1.5 text-xs font-bold text-muted-foreground"
      >
        <span class="h-2.5 w-2.5 rounded-full" :style="{ backgroundColor: serie.color }" />
        {{ serie.label }}
      </span>
    </div>
  </div>
</template>
