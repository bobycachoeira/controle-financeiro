import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { computeAccountBalance, detectFormat, parseOfxMeta, parseStatement, type ParsedImportRow } from "@cf/shared";
import type { AccountLike, BalanceTransaction } from "@cf/shared";
import { db } from "../db/schema";
import { updateLocal } from "../db/repositories";
import { useTransactionsStore } from "./transactions";

export type ImportDecision = "import" | "ignore" | "link";

export interface ImportMatch {
  id: string;
  description: string;
  date: string;
  amountCents: number;
  type: string;
}

export interface ImportRow {
  row: ParsedImportRow;
  match: ImportMatch | null;
  decision: ImportDecision;
}

export interface ImportPreview {
  validCount: number;
  invalidCount: number;
  totalCents: number;
  matchedCount: number;
}

export interface ImportResult {
  created: number;
  linked: number;
  ignored: number;
}

/** Janela de dias para considerar um lançamento existente como o mesmo evento. */
const WINDOW_DAYS = 3;

function daysBetween(a: string, b: string): number {
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return Number.POSITIVE_INFINITY;
  return Math.abs(left - right) / 86_400_000;
}

function natureMatches(txType: string, nature: "entrada" | "saida"): boolean {
  if (nature === "entrada") return txType === "receita";
  return txType === "despesa" || txType === "transferencia";
}

export const useImportStore = defineStore("import", () => {
  const rows = ref<ImportRow[]>([]);
  const importing = ref(false);
  const statementBalanceCents = ref<number | null>(null);
  const statementBalanceDate = ref<string | null>(null);
  const currentBalanceCents = ref<number | null>(null);

  /** Soma líquida das linhas que serão importadas (entrada +, saída -). */
  const projectedNetCents = computed(() =>
    rows.value
      .filter((item) => !item.row.error && item.decision === "import")
      .reduce(
        (sum, item) => sum + (item.row.nature === "entrada" ? item.row.amountCents : -item.row.amountCents),
        0,
      ),
  );

  /** Diferença entre o saldo projetado (após importar) e o saldo do extrato. */
  const balanceDiffCents = computed(() => {
    if (statementBalanceCents.value === null || currentBalanceCents.value === null) return null;
    return currentBalanceCents.value + projectedNetCents.value - statementBalanceCents.value;
  });

  function summary(): ImportPreview {
    const valid = rows.value.filter((item) => !item.row.error);
    return {
      validCount: valid.length,
      invalidCount: rows.value.length - valid.length,
      totalCents: valid.reduce(
        (sum, item) => sum + (item.row.nature === "entrada" ? item.row.amountCents : -item.row.amountCents),
        0,
      ),
      matchedCount: rows.value.filter((item) => item.match).length,
    };
  }

  function parse(text: string): ImportPreview {
    rows.value = parseStatement(text).map((row) => ({
      row,
      match: null,
      decision: "import" as ImportDecision,
    }));
    const meta = detectFormat(text) === "ofx" ? parseOfxMeta(text) : { balanceCents: null, balanceDate: null };
    statementBalanceCents.value = meta.balanceCents;
    statementBalanceDate.value = meta.balanceDate;
    currentBalanceCents.value = null;
    return summary();
  }

  /**
   * Conciliação: casa cada linha com lançamentos existentes da mesma conta por
   * valor + natureza + data (± janela). Sugere "Ignorar" quando há provável
   * duplicado, deixando o usuário decidir importar/vincular.
   */
  async function reconcile(accountId: string): Promise<void> {
    if (!accountId) {
      rows.value = rows.value.map((item) => ({ ...item, match: null, decision: "import" }));
      currentBalanceCents.value = null;
      return;
    }
    const existing = (
      await db.transactions.where("account").equals(accountId).toArray()
    ).filter((tx) => !tx.deleted_at);
    const account = await db.accounts.get(accountId);
    currentBalanceCents.value = account
      ? computeAccountBalance(account as AccountLike, existing as unknown as BalanceTransaction[])
      : null;
    const claimed = new Set<string>();

    rows.value = rows.value.map((item) => {
      if (item.row.error || !item.row.date) {
        return { ...item, match: null, decision: "import" };
      }
      const candidate = existing.find(
        (tx) =>
          !claimed.has(tx.id) &&
          tx.amount_cents === item.row.amountCents &&
          natureMatches(tx.type, item.row.nature) &&
          daysBetween(tx.date, item.row.date) <= WINDOW_DAYS,
      );
      if (!candidate) {
        return { ...item, match: null, decision: "import" };
      }
      claimed.add(candidate.id);
      return {
        ...item,
        match: {
          id: candidate.id,
          description: candidate.description,
          date: candidate.date,
          amountCents: candidate.amount_cents,
          type: candidate.type,
        },
        decision: "ignore",
      };
    });
  }

  function setDecision(externalRef: string, decision: ImportDecision): void {
    rows.value = rows.value.map((item) =>
      item.row.externalRef === externalRef ? { ...item, decision } : item,
    );
  }

  function setAllMatched(decision: ImportDecision): void {
    rows.value = rows.value.map((item) => (item.match ? { ...item, decision } : item));
  }

  async function confirm(accountId: string, categoryId: string | null): Promise<ImportResult> {
    importing.value = true;
    try {
      const transactions = useTransactionsStore();
      const result: ImportResult = { created: 0, linked: 0, ignored: 0 };

      for (const item of rows.value) {
        const row = item.row;
        if (row.error) continue;

        if (item.decision === "ignore") {
          result.ignored += 1;
          continue;
        }

        if (item.decision === "link" && item.match) {
          const existing = await db.transactions.get(item.match.id);
          if (existing) {
            // Vincula o lançamento manual ao registro do banco (evita duplicar).
            await updateLocal("transactions", { ...existing, external_ref: row.externalRef });
            result.linked += 1;
            continue;
          }
        }

        const duplicate = await transactions.findByExternalRef(row.externalRef);
        if (duplicate) {
          result.ignored += 1;
          continue;
        }

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
        result.created += 1;
      }

      rows.value = [];
      return result;
    } finally {
      importing.value = false;
    }
  }

  function reset(): void {
    rows.value = [];
    statementBalanceCents.value = null;
    statementBalanceDate.value = null;
    currentBalanceCents.value = null;
  }

  return {
    rows,
    importing,
    statementBalanceCents,
    statementBalanceDate,
    currentBalanceCents,
    projectedNetCents,
    balanceDiffCents,
    parse,
    reconcile,
    setDecision,
    setAllMatched,
    confirm,
    reset,
    summary,
  };
});
