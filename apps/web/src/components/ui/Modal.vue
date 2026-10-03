<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { X } from "lucide-vue-next";

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
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        role="presentation"
        @click.self="close"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          class="max-h-[92dvh] w-full max-w-md animate-pop overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-lift outline-none sm:rounded-[2rem]"
        >
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-bold tracking-tight">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
            </div>
            <button
              type="button"
              class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              aria-label="Fechar"
              @click="close"
            >
              <X class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
