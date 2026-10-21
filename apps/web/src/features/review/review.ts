import { diffInDays, merchantDisplayName } from "@cf/shared";
import type { LocalTransaction } from "@/db/schema";

/** Janela padrão (best practice: curta o suficiente para não virar dívida). */
export const REVIEW_WINDOW_DAYS = 30;
/** Janela estendida para quem quer arrumar o passado. */
export const REVIEW_WINDOW_DAYS_LONG = 90;

export interface ReviewQueueOptions {
  /** Categorias que contam como "a definir" (ex.: "Outros"/"Outras receitas"). */
  uncategorizedIds: ReadonlySet<string>;
  /** Categorias existentes (para achar vínculos quebrados). */
  knownIds?: ReadonlySet<string>;
  today: string;
  days?: number;
}

/**
 * Fila de revisão: lançamentos recentes sem categoria útil.
 * Entram: sem categoria, na categoria "Outros" (ou equivalentes) ou com
 * categoria inexistente. Transferências ficam fora (não têm categoria).
 */
export function selectReviewQueue(
  transactions: readonly LocalTransaction[],
  options: ReviewQueueOptions,
): LocalTransaction[] {
  const days = options.days ?? REVIEW_WINDOW_DAYS;
  return transactions
    .filter((tx) => !tx.deleted_at && tx.type !== "transferencia")
    .filter(
      (tx) =>
        !tx.category ||
        options.uncategorizedIds.has(tx.category) ||
        (options.knownIds !== undefined && !options.knownIds.has(tx.category)),
    )
    .filter((tx) => Math.abs(diffInDays(tx.date.slice(0, 10), options.today)) <= days)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const PLACEHOLDER_NAMES = new Set(["outros", "outras receitas", "não definido", "nao definido"]);

/** Ids das categorias que valem como "colocar numa depois". */
export function placeholderCategoryIds(
  categories: readonly { id: string; name: string }[],
): Set<string> {
  return new Set(
    categories
      .filter((category) => PLACEHOLDER_NAMES.has(category.name.trim().toLowerCase()))
      .map((category) => category.id),
  );
}

/**
 * Chave de similaridade entre descrições: a primeira palavra significativa
 * (>= 4 letras), sem acentos/maiúsculas. "Padaria do Zé" e "Padaria Central"
 * compartilham a chave "padaria".
 */
export function similarDescriptionKey(description: string): string | null {
  const normalized = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .trim();
  if (!normalized) return null;
  const words = normalized.split(/\s+/);
  return words.find((word) => word.length >= 4) ?? words[0] ?? null;
}

/** Outros lançamentos da fila "com a mesma cara" (mesma chave e mesmo tipo). */
export function findSimilarTransactions(
  tx: LocalTransaction,
  candidates: readonly LocalTransaction[],
): LocalTransaction[] {
  const key = similarDescriptionKey(merchantDisplayName(tx));
  if (!key) return [];
  return candidates.filter((candidate) => {
    if (candidate.id === tx.id || candidate.deleted_at) return false;
    if (candidate.type !== tx.type) return false;
    return similarDescriptionKey(merchantDisplayName(candidate)) === key;
  });
}
