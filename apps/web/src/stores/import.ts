import { defineStore } from "pinia";
import { ref } from "vue";
import { parseStatement, type ParsedImportRow } from "@cf/shared";
import { useTransactionsStore } from "./transactions";

export interface ImportPreview {
  rows: ParsedImportRow[];
  validCount: number;
  invalidCount: number;
  totalCents: number;
}

export const useImportStore = defineStore("import", () => {
  const rows = ref<ParsedImportRow[]>([]);
  const importing = ref(false);

  function parse(text: string): ImportPreview {
    rows.value = parseStatement(text);
    const valid = rows.value.filter((row) => !row.error);
    return {
      rows: rows.value,
      validCount: valid.length,
      invalidCount: rows.value.length - valid.length,
      totalCents: valid.reduce(
        (sum, row) => sum + (row.nature === "entrada" ? row.amountCents : -row.amountCents),
        0,
      ),
    };
  }

  async function confirm(accountId: string, categoryId: string | null): Promise<number> {
    importing.value = true;
    try {
      const transactions = useTransactionsStore();
      let created = 0;
      for (const row of rows.value) {
        if (row.error) continue;
        const existing = await transactions.findByExternalRef(row.externalRef);
        if (existing) continue;
        await transactions.create({
          account: accountId,
          credit_card: null,
          amount_cents: row.amountCents,
          type: row.nature === "entrada" ? "receita" : "despesa",
          date: row.date,
          attribution: "indefinido",
          category: categoryId,
          description: row.description,
          status: "pago",
          origin: "import",
          external_ref: row.externalRef,
        });
        created += 1;
      }
      rows.value = [];
      return created;
    } finally {
      importing.value = false;
    }
  }

  function reset(): void {
    rows.value = [];
  }

  return { rows, importing, parse, confirm, reset };
});
