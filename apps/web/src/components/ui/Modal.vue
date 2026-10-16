<script lang="ts">
// Estado compartilhado entre instâncias (modais empilhados, ver onPopState).
let modalSeq = 0;
let ignoreNextPop = false;
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { X } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    description?: string;
    /** Fecha ao tocar fora do painel (desligue quando houver dados não salvos). */
    closeOnOutside?: boolean;
  }>(),
  { description: undefined, closeOnOutside: true },
);
const emit = defineEmits<{ "update:modelValue": [boolean] }>();

const panel = ref<HTMLElement | null>(null);
const modalId = ++modalSeq;
let pushed = false;

function close(): void {
  emit("update:modelValue", false);
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") close();
}

/**
 * Gesto/botão de voltar do Android: com o modal aberto, um pushState garante
 * que o "voltar" fecha o modal em vez de sair da tela por baixo dele.
 * Modais empilhados: só fecha o que está no topo (o estado "de baixo" volta a
 * ser o atual no popstate).
 */
function onPopState(event: PopStateEvent): void {
  if (ignoreNextPop) {
    ignoreNextPop = false;
    return;
  }
  const state = event.state as { cfModal?: number } | null;
  if (state?.cfModal === modalId) return;
  if (!props.modelValue) return;
  pushed = false;
  close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      history.pushState({ cfModal: modalId }, "");
      pushed = true;
      window.addEventListener("popstate", onPopState);
      requestAnimationFrame(() => panel.value?.focus());
      document.body.style.overflow = "hidden";
    } else {
      window.removeEventListener("popstate", onPopState);
      if (pushed) {
        pushed = false;
        ignoreNextPop = true;
        history.back();
      }
      document.body.style.overflow = "";
    }
  },
);

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKeydown);
  window.removeEventListener("popstate", onPopState);
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
        @click.self="closeOnOutside && close()"
      >
        <div
          ref="panel"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
          tabindex="-1"
          class="max-h-[92dvh] w-full max-w-md animate-pop overflow-y-auto rounded-t-[2rem] bg-card p-6 shadow-lift outline-none [scroll-padding-bottom:45vh] sm:rounded-[2rem]"
        >
          <div class="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-bold tracking-tight">{{ title }}</h2>
              <p v-if="description" class="mt-1 text-sm text-muted-foreground">{{ description }}</p>
            </div>
            <button
              type="button"
              class="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground transition hover:bg-secondary hover:text-foreground"
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
