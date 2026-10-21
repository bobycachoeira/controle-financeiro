import { normalizeMerchantName } from "@cf/shared";
import type { LocalTransaction } from "@/db/schema";

/** Uma descrição vista no histórico, com o contexto mais recente dela. */
export interface HistorySuggestion {
  description: string;
  count: number;
  lastUsed: string;
  category: string | null;
  type: "receita" | "despesa";
}

function isUsableTransaction(tx: LocalTransaction): boolean {
  return !tx.deleted_at && (tx.type === "receita" || tx.type === "despesa");
}

function keyOf(description: string): string {
  return description.trim().toLowerCase();
}

/**
 * Indexa descrições do histórico (agrupadas sem diferenciar maiúsculas) para
 * sugerir descrição + categoria no lançamento rápido. A categoria sugerida é a
 * da ocorrência mais recente com categoria definida.
 */
export function buildHistoryIndex(
  transactions: readonly LocalTransaction[],
): HistorySuggestion[] {
  const map = new Map<string, HistorySuggestion>();
  for (const tx of transactions) {
    if (!isUsableTransaction(tx)) continue;
    const description = tx.description.trim();
    if (!description) continue;
    const key = keyOf(description);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        description,
        count: 1,
        lastUsed: tx.date,
        category: tx.category ?? null,
        type: tx.type as "receita" | "despesa",
      });
      continue;
    }
    existing.count += 1;
    if (tx.date > existing.lastUsed) {
      existing.lastUsed = tx.date;
      existing.description = description;
      existing.type = tx.type as "receita" | "despesa";
      if (tx.category) existing.category = tx.category;
    } else if (!existing.category && tx.category) {
      existing.category = tx.category;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || (a.lastUsed < b.lastUsed ? 1 : -1),
  );
}

/**
 * Sugestões para o que está sendo digitado: primeiro o que começa com o termo,
 * depois o que contém; empate resolvido pela frequência. Termo vazio devolve as
 * mais frequentes/recentes.
 */
export function suggestDescriptions(
  input: string,
  index: readonly HistorySuggestion[],
  limit = 3,
): HistorySuggestion[] {
  const term = input.trim().toLowerCase();
  if (!term) return index.slice(0, limit);
  const startsWith: HistorySuggestion[] = [];
  const contains: HistorySuggestion[] = [];
  for (const entry of index) {
    const description = entry.description.toLowerCase();
    if (description === term) continue;
    if (description.startsWith(term)) startsWith.push(entry);
    else if (description.includes(term)) contains.push(entry);
  }
  return [...startsWith, ...contains].slice(0, limit);
}

function cutoffISO(today: string, days: number): string {
  const cutoff = new Date(`${today}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - days);
  return cutoff.toISOString().slice(0, 10);
}

export interface RecentCategoryOptions {
  kind?: "receita" | "despesa";
  today: string;
  days?: number;
  limit?: number;
}

/** Categorias mais usadas nos últimos dias (para os chips do quick add). */
export function recentCategoryIds(
  transactions: readonly LocalTransaction[],
  options: RecentCategoryOptions,
): string[] {
  const days = options.days ?? 90;
  const limit = options.limit ?? 5;
  const cutoff = cutoffISO(options.today, days);
  const counts = new Map<string, { count: number; lastUsed: string }>();
  for (const tx of transactions) {
    if (!isUsableTransaction(tx)) continue;
    if (options.kind && tx.type !== options.kind) continue;
    if (!tx.category || tx.date < cutoff) continue;
    const entry = counts.get(tx.category);
    if (!entry) counts.set(tx.category, { count: 1, lastUsed: tx.date });
    else {
      entry.count += 1;
      if (tx.date > entry.lastUsed) entry.lastUsed = tx.date;
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count || (a[1].lastUsed < b[1].lastUsed ? 1 : -1))
    .slice(0, limit)
    .map(([id]) => id);
}

/** Contas usadas mais recentemente (para o default do quick add). */
export function recentAccountIds(
  transactions: readonly LocalTransaction[],
  limit = 3,
): string[] {
  const lastUsed = new Map<string, string>();
  for (const tx of transactions) {
    if (tx.deleted_at || tx.type === "transferencia") continue;
    const current = lastUsed.get(tx.account);
    if (!current || tx.date > current) lastUsed.set(tx.account, tx.date);
  }
  return [...lastUsed.entries()]
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, limit)
    .map(([id]) => id);
}

export interface MerchantSuggestion {
  merchant: string;
  count: number;
  lastUsed: string;
  category: string | null;
  type: "receita" | "despesa";
}

/**
 * Indexa estabelecimentos já usados (sem cadastro prévio). Nomes equivalentes
 * em caixa/acentos são agrupados; a grafia mais recente é a exibida.
 */
export function buildMerchantIndex(
  transactions: readonly LocalTransaction[],
): MerchantSuggestion[] {
  const map = new Map<string, MerchantSuggestion>();
  for (const tx of transactions) {
    if (!isUsableTransaction(tx)) continue;
    const merchant = (tx.merchant ?? "").trim();
    if (!merchant) continue;
    const key = normalizeMerchantName(merchant);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        merchant,
        count: 1,
        lastUsed: tx.date,
        category: tx.category ?? null,
        type: tx.type as "receita" | "despesa",
      });
      continue;
    }
    existing.count += 1;
    if (tx.date > existing.lastUsed) {
      existing.lastUsed = tx.date;
      existing.merchant = merchant;
      existing.type = tx.type as "receita" | "despesa";
      if (tx.category) existing.category = tx.category;
    } else if (!existing.category && tx.category) {
      existing.category = tx.category;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || (a.lastUsed < b.lastUsed ? 1 : -1),
  );
}

/** Sugestões de estabelecimento para o que está sendo digitado. */
export function suggestMerchants(
  input: string,
  index: readonly MerchantSuggestion[],
  limit = 3,
  type?: "receita" | "despesa",
): MerchantSuggestion[] {
  const candidates = type ? index.filter((entry) => entry.type === type) : index;
  const term = normalizeMerchantName(input);
  if (!term) return candidates.slice(0, limit);
  const startsWith: MerchantSuggestion[] = [];
  const contains: MerchantSuggestion[] = [];
  for (const entry of candidates) {
    const merchant = normalizeMerchantName(entry.merchant);
    if (merchant === term) continue;
    if (merchant.startsWith(term)) startsWith.push(entry);
    else if (merchant.includes(term)) contains.push(entry);
  }
  return [...startsWith, ...contains].slice(0, limit);
}

/** Categoria mais recente associada ao estabelecimento, se houver. */
export function findMerchantCategory(
  merchant: string,
  index: readonly MerchantSuggestion[],
  type?: "receita" | "despesa",
): string | null {
  const key = normalizeMerchantName(merchant);
  if (!key) return null;
  const entry = index.find(
    (item) => normalizeMerchantName(item.merchant) === key && (!type || item.type === type),
  );
  return entry?.category ?? null;
}
