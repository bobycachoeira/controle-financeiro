import { monthOf } from "./dates";

/** Prefixo da transferência que registra um acerto (débito/crédito entre pessoas). */
export const SETTLEMENT_TRANSFER_PREFIX = "Acerto do mês";

export interface SettlementPerson {
  key: string;
  label: string;
}

export interface SettlementTransaction {
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  amount_cents: number;
  attribution: string;
  payer_user?: string | null;
  date: string;
  deleted_at?: string | null;
}

export interface SettlementTransferLike {
  amount_cents: number;
  date: string;
  description?: string | null;
  source_owner?: string | null;
  destination_owner?: string | null;
  deleted_at?: string | null;
}

export interface SettlementInput {
  people: readonly SettlementPerson[];
  transactions: readonly SettlementTransaction[];
  transfers?: readonly SettlementTransferLike[];
  /** Mês de referência no formato `YYYY-MM`. */
  month: string;
  /** Mapeia chaves antigas (ex.: "meu"/"dela") para as pessoas atuais. */
  legacyMap?: Record<string, number>;
}

export interface SettlementPersonResult extends SettlementPerson {
  /** Quanto a pessoa pagou no mês (despesas + acertos que ela adiantou). */
  paidCents: number;
  /** Quanto a pessoa usufruiu (a parte dela nas despesas + acertos recebidos). */
  shareCents: number;
  /** Positivo = tem a receber; negativo = deve. */
  netCents: number;
}

export interface SettlementSuggestion {
  fromKey: string;
  toKey: string;
  amountCents: number;
}

export interface SettlementResult {
  people: SettlementPersonResult[];
  suggestions: SettlementSuggestion[];
  /** Total de despesas consideradas no mês. */
  consideredCents: number;
  /** Despesas do mês sem pagador identificado (fora do cálculo). */
  ignoredCents: number;
}

function splitEvenly(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function resolveBeneficiaries(
  attribution: string,
  people: readonly SettlementPerson[],
  legacyMap?: Record<string, number>,
): string[] {
  if (people.length === 0) return [];
  if (attribution === "ambos" || attribution === "indefinido") {
    return people.map((person) => person.key);
  }
  const direct = people.find((person) => person.key === attribution);
  if (direct) return [direct.key];
  const legacyIndex = legacyMap?.[attribution];
  if (legacyIndex !== undefined && people[legacyIndex]) return [people[legacyIndex]!.key];
  // Atribuição desconhecida: rateia entre todos (é gasto da família).
  return people.map((person) => person.key);
}

/**
 * Acerto do mês: quem adiantou dinheiro por quem. Considera despesas pagas do
 * mês (o pagador é `payer_user` e os beneficiários vêm da atribuição) e os
 * acertos já registrados (transferências com o prefixo de acerto).
 */
export function computeSettlement(input: SettlementInput): SettlementResult {
  const rows = new Map(
    input.people.map((person) => [
      person.key,
      { ...person, paidCents: 0, shareCents: 0, netCents: 0 },
    ]),
  );
  let consideredCents = 0;
  let ignoredCents = 0;

  for (const tx of input.transactions) {
    if (tx.deleted_at || tx.type !== "despesa" || tx.status !== "pago") continue;
    if (monthOf(tx.date) !== input.month) continue;
    const payer = tx.payer_user ? rows.get(tx.payer_user) : undefined;
    if (!payer) {
      ignoredCents += tx.amount_cents;
      continue;
    }
    const beneficiaries = resolveBeneficiaries(tx.attribution, input.people, input.legacyMap);
    if (beneficiaries.length === 0) continue;
    payer.paidCents += tx.amount_cents;
    const shares = splitEvenly(tx.amount_cents, beneficiaries.length);
    beneficiaries.forEach((key, index) => {
      const person = rows.get(key);
      if (person) person.shareCents += shares[index] ?? 0;
    });
    consideredCents += tx.amount_cents;
  }

  for (const transfer of input.transfers ?? []) {
    if (transfer.deleted_at) continue;
    if (!(transfer.description ?? "").startsWith(SETTLEMENT_TRANSFER_PREFIX)) continue;
    if (monthOf(transfer.date) !== input.month) continue;
    const from = transfer.source_owner ? rows.get(transfer.source_owner) : undefined;
    const to = transfer.destination_owner ? rows.get(transfer.destination_owner) : undefined;
    if (!from || !to || from.key === to.key) continue;
    from.paidCents += transfer.amount_cents;
    to.shareCents += transfer.amount_cents;
  }

  const people = input.people.map((person) => {
    const row = rows.get(person.key)!;
    row.netCents = row.paidCents - row.shareCents;
    return row;
  });

  const creditors = people
    .filter((person) => person.netCents > 0)
    .map((person) => ({ key: person.key, value: person.netCents }))
    .sort((a, b) => b.value - a.value);
  const debtors = people
    .filter((person) => person.netCents < 0)
    .map((person) => ({ key: person.key, value: -person.netCents }))
    .sort((a, b) => b.value - a.value);

  const suggestions: SettlementSuggestion[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex]!;
    const debtor = debtors[debtorIndex]!;
    const amount = Math.min(creditor.value, debtor.value);
    if (amount > 0) {
      suggestions.push({ fromKey: debtor.key, toKey: creditor.key, amountCents: amount });
    }
    creditor.value -= amount;
    debtor.value -= amount;
    if (creditor.value === 0) creditorIndex += 1;
    if (debtor.value === 0) debtorIndex += 1;
  }

  return { people, suggestions, consideredCents, ignoredCents };
}
