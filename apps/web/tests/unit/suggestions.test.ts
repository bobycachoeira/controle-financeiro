import { describe, expect, it } from "vitest";
import type { LocalTransaction } from "@/db/schema";
import {
  buildHistoryIndex,
  recentAccountIds,
  recentCategoryIds,
  suggestDescriptions,
} from "@/features/transactions/suggestions";

function tx(partial: Partial<LocalTransaction> & { id: string }): LocalTransaction {
  return {
    household: "h1",
    sync_id: `s-${partial.id}`,
    account: "a1",
    credit_card: null,
    amount_cents: 1000,
    currency: "BRL",
    type: "despesa",
    date: "2026-10-10",
    attribution: "meu",
    category: null,
    description: "Item",
    status: "pago",
    tags: [],
    note: "",
    origin: "manual",
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

describe("sugestões do histórico", () => {
  it("agrupa descrições ignorando maiúsculas e ordena por frequência", () => {
    const index = buildHistoryIndex([
      tx({ id: "1", description: "Mercado da semana" }),
      tx({ id: "2", description: "mercado da semana", date: "2026-10-12" }),
      tx({ id: "3", description: "Gasolina" }),
      tx({ id: "4", description: "mercado da semana", deleted_at: "x" }),
    ]);
    expect(index[0]?.description).toBe("mercado da semana");
    expect(index[0]?.count).toBe(2);
    expect(index[1]?.description).toBe("Gasolina");
  });

  it("carrega a categoria mais recente de cada descrição", () => {
    const index = buildHistoryIndex([
      tx({ id: "1", description: "Padaria", category: "padaria-id", date: "2026-09-01" }),
      tx({ id: "2", description: "Padaria", category: "mercado-id", date: "2026-10-01" }),
    ]);
    expect(index[0]?.category).toBe("mercado-id");
  });

  it("sugere por prefixo antes de 'contém' e ignora o termo exato", () => {
    const index = buildHistoryIndex([
      tx({ id: "1", description: "Padaria do Zé" }),
      tx({ id: "2", description: "Pão da padaria", date: "2026-10-11" }),
      tx({ id: "3", description: "Padaria" }),
    ]);
    const suggestions = suggestDescriptions("padaria", index);
    expect(suggestions.map((item) => item.description)).toEqual([
      "Padaria do Zé",
      "Pão da padaria",
    ]);
  });

  it("sem termo devolve as mais frequentes", () => {
    const index = buildHistoryIndex([
      tx({ id: "1", description: "Café" }),
      tx({ id: "2", description: "Café" }),
      tx({ id: "3", description: "Uber" }),
    ]);
    expect(suggestDescriptions("", index, 1).map((item) => item.description)).toEqual(["Café"]);
  });

  it("recentCategoryIds filtra por tipo, janela e ordena por uso", () => {
    const transactions = [
      tx({ id: "1", category: "mercado", date: "2026-10-14" }),
      tx({ id: "2", category: "mercado", date: "2026-10-01" }),
      tx({ id: "3", category: "lazer", date: "2026-10-10" }),
      tx({ id: "4", category: "antiga", date: "2026-01-01" }),
      tx({ id: "5", category: "salario", type: "receita", date: "2026-10-13" }),
    ];
    expect(
      recentCategoryIds(transactions, { today: "2026-10-15", days: 90, kind: "despesa" }),
    ).toEqual(["mercado", "lazer"]);
    expect(
      recentCategoryIds(transactions, { today: "2026-10-15", days: 90, kind: "receita" }),
    ).toEqual(["salario"]);
  });

  it("recentAccountIds usa a data mais recente de uso", () => {
    expect(
      recentAccountIds([
        tx({ id: "1", account: "a1", date: "2026-09-01" }),
        tx({ id: "2", account: "a2", date: "2026-10-10" }),
        tx({ id: "3", account: "a1", date: "2026-10-01" }),
      ]),
    ).toEqual(["a2", "a1"]);
  });
});
