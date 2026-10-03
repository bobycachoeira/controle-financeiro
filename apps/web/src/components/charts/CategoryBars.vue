<script setup lang="ts">
import { computed } from "vue";
import { formatBRL } from "@/lib/format";

const props = defineProps<{
  items: { name: string; color: string; totalCents: number }[];
}>();

const max = computed(() => Math.max(1, ...props.items.map((item) => item.totalCents)));
</script>

<template>
  <ul class="space-y-2.5">
    <li v-for="item in items" :key="item.name" class="space-y-1">
      <div class="flex items-center justify-between text-xs font-bold">
        <span class="flex min-w-0 items-center gap-1.5">
          <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ backgroundColor: item.color }" />
          <span class="truncate">{{ item.name }}</span>
        </span>
        <span>{{ formatBRL(item.totalCents) }}</span>
      </div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          class="h-full rounded-full transition-all duration-500"
          :style="{ width: `${(item.totalCents / max) * 100}%`, backgroundColor: item.color }"
        />
      </div>
    </li>
  </ul>
</template>
