<script setup lang="ts">
import { ref } from "vue";
import { Check } from "lucide-vue-next";
import { CHIP_COLORS, ICON_NAMES, resolveIcon } from "@/lib/icons";
import { cn } from "@/lib/utils";
import IconChip from "./IconChip.vue";

const props = withDefaults(
  defineProps<{ icon?: string | null; color?: string | null; name?: string }>(),
  { icon: null, color: null, name: "" },
);
const emit = defineEmits<{ "update:icon": [string]; "update:color": [string] }>();

const showIcons = ref(false);
const icons = ICON_NAMES;
const colors = CHIP_COLORS;
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-3">
      <IconChip :name="props.icon" :color="props.color" :seed="props.name" size="lg" />
      <button
        type="button"
        class="rounded-full border-2 border-border px-4 py-2 text-sm font-extrabold text-foreground transition hover:bg-muted"
        @click="showIcons = !showIcons"
      >
        {{ showIcons ? "Fechar ícones" : "Escolher ícone" }}
      </button>
    </div>

    <div v-if="showIcons" class="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-2xl bg-muted p-2">
      <button
        v-for="iconName in icons"
        :key="iconName"
        type="button"
        class="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-card"
        :class="iconName === props.icon && 'bg-card text-primary shadow-soft'"
        :aria-label="iconName"
        @click="emit('update:icon', iconName)"
      >
        <component :is="resolveIcon(iconName)" class="h-[1.1rem] w-[1.1rem]" />
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="c in colors"
        :key="c"
        type="button"
        data-compact
        class="grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-card transition"
        :class="cn(c === props.color && 'ring-2')"
        :style="{ backgroundColor: c, color: '#fff' }"
        :aria-label="`cor ${c}`"
        @click="emit('update:color', c)"
      >
        <Check v-if="c === props.color" class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
