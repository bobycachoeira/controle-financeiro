import { defineStore } from "pinia";
import { ref } from "vue";

/** Dados que o quick add pré-preenche (ex.: duplicar um lançamento). */
export interface QuickAddPrefill {
  type?: "receita" | "despesa";
  amountCents?: number | null;
  merchant?: string;
  description?: string;
  category?: string | null;
  account?: string;
  creditCard?: string | null;
  attribution?: string;
  tags?: string[];
  date?: string;
}

/**
 * Controla o bottom sheet de lançamento rápido, disponível em todas as telas
 * do app (FAB no layout). O formulário completo continua em
 * `/transactions/new` para edição e fluxos avançados.
 */
export const useQuickAddStore = defineStore("quick-add", () => {
  const open = ref(false);
  const prefill = ref<QuickAddPrefill | null>(null);

  function show(request?: QuickAddPrefill): void {
    prefill.value = request ?? null;
    open.value = true;
  }

  function hide(): void {
    open.value = false;
    prefill.value = null;
  }

  return { open, prefill, show, hide };
});
