import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { normalizeMerchantName } from "@cf/shared";
import { db, type LocalCreditCard } from "@/db/schema";
import { parseCardImportCSV, type CardImportRow } from "@/lib/card-import";
import { useTransactionsStore } from "./transactions";

export interface CardImportResult {
  created: number;
  skipped: number;
  invalid: number;
}

/**
 * Importa compras parceladas em andamento (uma linha por compra) usando o mesmo
 * fluxo da tela de novo lançamento: valor da parcela, total e já pagas.
 */
export const useCardImportStore = defineStore("cardImport", () => {
  const rows = ref<CardImportRow[]>([]);
  const importing = ref(false);

  const validRows = computed(() => rows.value.filter((row) => !row.error));
  const invalidCount = computed(() => rows.value.filter((row) => row.error).length);
  const totalPerParcelCents = computed(() =>
    validRows.value.reduce((sum, row) => sum + row.amountCents, 0),
  );
  const remainingCount = computed(() =>
    validRows.value.reduce((sum, row) => sum + (row.installments - row.paidInstallments), 0),
  );

  function parse(text: string): void {
    rows.value = parseCardImportCSV(text);
  }

  function reset(): void {
    rows.value = [];
  }

  async function confirm(
    card: LocalCreditCard,
    defaultCategoryId: string | null,
  ): Promise<CardImportResult> {
    importing.value = true;
    try {
      const transactions = useTransactionsStore();
      const categories = (
        await db.categories.where("household").equals(card.household).toArray()
      ).filter((category) => !category.deleted_at && category.active !== false);
      const categoryByName = new Map(
        categories.map((category) => [normalizeMerchantName(category.name), category.id]),
      );
      const result: CardImportResult = { created: 0, skipped: 0, invalid: 0 };

      for (const row of rows.value) {
        if (row.error) {
          result.invalid += 1;
          continue;
        }
        if (await transactions.findByExternalRef(row.externalRef)) {
          result.skipped += 1;
          continue;
        }
        const resolvedCategory =
          (row.categoryName
            ? categoryByName.get(normalizeMerchantName(row.categoryName))
            : undefined) ?? defaultCategoryId;
        await transactions.createCardPurchase({
          account: card.account,
          credit_card: card.id,
          amount_cents: row.amountCents,
          date: row.date,
          attribution: card.owner && card.owner !== "indefinido" ? card.owner : "indefinido",
          category: resolvedCategory,
          merchant: row.merchant,
          description: row.description,
          status: "a_pagar",
          origin: "import",
          external_ref: row.externalRef,
          installments: row.installments,
          paid_installments: row.paidInstallments,
          closing_day: card.closing_day,
          due_day: card.due_day,
        });
        result.created += 1;
      }

      rows.value = [];
      return result;
    } finally {
      importing.value = false;
    }
  }

  return {
    rows,
    importing,
    validRows,
    invalidCount,
    totalPerParcelCents,
    remainingCount,
    parse,
    reset,
    confirm,
  };
});
