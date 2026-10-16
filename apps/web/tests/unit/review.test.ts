import { describe, expect, it } from "vitest";
import type { LocalTransaction } from "@/db/schema";
import {
  placeholderCategoryIds,
  REVIEW_WINDOW_DAYS,
  selectReviewQueue,
} from "@/features/review/review";

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

describe("fila de revisão", () => {
  const uncategorized = new Set(["outros-id"]);
  const known = new Set(["outros-id", "mercado-id"]);

  it("inclui sem categoria, 'Outros' e categoria inexistente", () => {
    const queue = selectReviewQueue(
      [
        tx({ id: "a", category: null }),
        tx({ id: "b", category: "outros-id" }),
        tx({ id: "c", category: "mercado-id" }),
        tx({ id: "d", category: "sumiu-id" }),
        tx({ id: "e", type: "transferencia", category: null }),
        tx({ id: "f", category: "outros-id", deleted_at: "x" }),
      ],
      { uncategorizedIds: uncategorized, knownIds: known, today: "2026-10-15" },
    );
    expect(queue.map((item) => item.id)).toEqual(["a", "b", "d"]);
  });

  it("limita pela janela de dias", () => {
    const queue = selectReviewQueue(
      [
        tx({ id: "novo", category: null, date: "2026-10-14" }),
        tx({ id: "antigo", category: null, date: "2026-06-01" }),
      ],
      { uncategorizedIds: uncategorized, today: "2026-10-15", days: REVIEW_WINDOW_DAYS },
    );
    expect(queue.map((item) => item.id)).toEqual(["novo"]);
  });

  it("identifica as categorias de reserva pelo nome", () => {
    const ids = placeholderCategoryIds([
      { id: "x", name: "Outros" },
      { id: "y", name: "Outras receitas" },
      { id: "z", name: "Mercado" },
    ]);
    expect([...ids].sort()).toEqual(["x", "y"]);
  });
});
