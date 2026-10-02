<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  description?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const panel = ref<HTMLElement | null>(null);

function close(): void {
  emit("update:modelValue", false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      requestAnimationFrame(() => panel.value?.focus());
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  },
);

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  document.body.style.overflow = "";
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      @click.self="close"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        tabindex="-1"
        class="w-full max-w-md rounded-t-xl bg-background p-5 shadow-lg outline-none sm:rounded-xl"
      >
        <h2 class="text-lg font-semibold">{{ title }}</h2>
        <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
        <div class="mt-4">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
