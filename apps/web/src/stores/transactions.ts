import { defineStore } from "pinia";
import { ref } from "vue";
import type { TransactionStatus, TransactionType } from "@cf/shared";
import {
  closingDateForMonth,
  dueDateForMonth,
  generateInstallments,
  referenceMonthForPurchase,
} from "@cf/shared";
import { db, type LocalInstallment, type LocalInvoice, type LocalTransaction } from "../db/schema";
import { createLocal, newSyncId, softDeleteLocal, updateLocal, updateLocalOnly, newLocalId } from "../db/repositories";
import { useSessionStore } from "./session";

export interface TransactionFilters {
  month?: string;
  account?: string;
  category?: string;
  attribution?: string;
  status?: TransactionStatus;
  creditCard?: string;
  reconciled?: "all" | "yes" | "no";
}

export interface TransactionInput {
  account: string;
  credit_card?: string | null;
  amount_cents: number;
  type: TransactionType;
  date: string;
  attribution: string;
  category?: string | null;
  description?: string;
  status: TransactionStatus;
  note?: string;
  origin?: "manual" | "import" | "recurrence";
  external_ref?: string | null;
}

export interface CardPurchaseInput extends Omit<TransactionInput, "type"> {
  installments: number;
  closing_day: number;
  due_day: number;
}

export const useTransactionsStore = defineStore("transactions", () => {
  const items = ref<LocalTransaction[]>([]);
  const loading = ref(false);

  async function load(filters: TransactionFilters = {}): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    loading.value = true;
    try {
      const all = (
        await db.transactions.where("household").equals(session.currentHouseholdId).toArray()
      ).filter((tx) => !tx.deleted_at);
      items.value = all.filter((tx) => {
        if (filters.month && !tx.date.startsWith(filters.month)) return false;
        if (filters.account && tx.account !== filters.account) return false;
        if (filters.category && tx.category !== filters.category) return false;
        if (filters.attribution && tx.attribution !== filters.attribution) return false;
        if (filters.status && tx.status !== filters.status) return false;
        if (filters.creditCard && tx.credit_card !== filters.creditCard) return false;
        if (filters.reconciled === "yes" && !tx.external_ref) return false;
        if (filters.reconciled === "no" && tx.external_ref) return false;
        return true;
      });
      items.value.sort((a, b) => (a.date < b.date ? 1 : -1));
    } finally {
      loading.value = false;
    }
  }

  function baseRecord(input: TransactionInput): LocalTransaction {
    const session = useSessionStore();
    return {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      account: input.account,
      credit_card: input.credit_card ?? null,
      amount_cents: input.amount_cents,
      currency: "BRL",
      type: input.type,
      date: input.date,
      posting_date: null,
      attribution: input.attribution,
      payer_user: session.user?.id ?? null,
      category: input.category ?? null,
      description: input.description ?? "",
      status: input.status,
      recurrence: null,
      installment: null,
      invoice: null,
      transfer: null,
      attachment: null,
      tags: [],
      note: input.note ?? "",
      origin: input.origin ?? "manual",
      external_ref: input.external_ref ?? null,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
  }

  async function findByExternalRef(ref: string): Promise<LocalTransaction | undefined> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return undefined;
    return db.transactions
      .where("household")
      .equals(session.currentHouseholdId)
      .filter((tx) => tx.external_ref === ref && !tx.deleted_at)
      .first();
  }

  async function create(input: TransactionInput): Promise<LocalTransaction> {
    if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) {
      throw new Error("Valor deve ser maior que zero.");
    }
    const record = baseRecord(input);
    await createLocal("transactions", record);
    await load();
    return record;
  }

  async function createCardPurchase(input: CardPurchaseInput): Promise<void> {
    if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) {
      throw new Error("Valor deve ser maior que zero.");
    }
    const session = useSessionStore();
    const household = session.currentHouseholdId ?? "";
    const installments = generateInstallments(
      input.date,
      input.amount_cents,
      input.installments,
      input.closing_day,
    );

    const root = baseRecord({ ...input, type: "despesa" });
    const groupId = newSyncId();

    for (const installment of installments) {
      const referenceMonth = installment.reference_month;
      const invoiceId = await ensureInvoice(
        household,
        input.credit_card ?? "",
        input.account,
        referenceMonth,
        input.closing_day,
        input.due_day,
      );

      const tx: LocalTransaction = {
        ...root,
        id: newLocalId(),
        sync_id: newSyncId(),
        amount_cents: installment.amount_cents,
        date: installment.expected_date,
        invoice: invoiceId,
      };

      const installmentRecord: LocalInstallment = {
        id: newLocalId(),
        household,
        sync_id: newSyncId(),
        installment_group_id: groupId,
        root_transaction: tx.id,
        number: installment.number,
        total: installment.total,
        amount_cents: installment.amount_cents,
        expected_date: installment.expected_date,
        invoice: invoiceId,
        paid: false,
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      };

      await createLocal("transactions", tx);
      await createLocal("installments", installmentRecord);
      await recalcInvoice(invoiceId);
    }
    await load();
  }

  async function ensureInvoice(
    household: string,
    creditCard: string,
    account: string,
    referenceMonth: string,
    closingDay: number,
    dueDay: number,
  ): Promise<string> {
    const existing = await db.invoices
      .where("household")
      .equals(household)
      .filter((invoice) => invoice.credit_card === creditCard && invoice.reference_month === referenceMonth)
      .first();
    if (existing) return existing.id;
    const invoice: LocalInvoice = {
      id: newLocalId(),
      household,
      sync_id: newSyncId(),
      credit_card: creditCard,
      account,
      reference_month: referenceMonth,
      closing_date: closingDateForMonth(referenceMonth, closingDay),
      due_date: dueDateForMonth(referenceMonth, dueDay),
      total_cents: 0,
      paid_cents: 0,
      status: "aberta",
      closed_at: null,
      paid_at: null,
      note: "",
      updated_by: null,
      deleted_at: null,
    };
    await createLocal("invoices", invoice);
    return invoice.id;
  }

  async function recalcInvoice(invoiceId: string): Promise<void> {
    const invoice = await db.invoices.get(invoiceId);
    if (!invoice) return;
    const transactions = await db.transactions.where("invoice").equals(invoiceId).toArray();
    const total = transactions
      .filter((tx) => !tx.deleted_at)
      .reduce((sum, tx) => sum + tx.amount_cents, 0);
    // O servidor recalcula a fatura ao aplicar as transações; enviar o total
    // daqui só disputa com o recálculo (updated do servidor mais novo).
    await updateLocalOnly("invoices", { ...invoice, total_cents: total });
  }

  async function update(id: string, changes: Partial<TransactionInput>): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;
    const updated = { ...existing, ...changes } as LocalTransaction;
    await updateLocal("transactions", updated);
    if (updated.invoice) await recalcInvoice(updated.invoice);
    await load();
  }

  /**
   * Edita uma compra no cartão, incluindo a troca do cartão: a transação (e a
   * parcela) passa para a fatura do novo cartão no ciclo da data da compra.
   */
  async function updateCardPurchase(
    id: string,
    changes: Partial<TransactionInput> & { credit_card?: string | null },
  ): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;
    const newCardId = changes.credit_card ?? existing.credit_card ?? "";
    if (!newCardId || newCardId === existing.credit_card) {
      await update(id, changes);
      return;
    }
    const card = await db.credit_cards.get(newCardId);
    if (!card) {
      await update(id, changes);
      return;
    }
    const referenceMonth = referenceMonthForPurchase(existing.date, card.closing_day);
    const invoiceId = await ensureInvoice(
      existing.household,
      newCardId,
      card.account,
      referenceMonth,
      card.closing_day,
      card.due_day,
    );
    const updated: LocalTransaction = {
      ...existing,
      ...changes,
      account: card.account,
      credit_card: newCardId,
      invoice: invoiceId,
    } as LocalTransaction;
    await updateLocal("transactions", updated);
    if (existing.invoice && existing.invoice !== invoiceId) await recalcInvoice(existing.invoice);
    await recalcInvoice(invoiceId);
    const installments = await db.installments.where("root_transaction").equals(id).toArray();
    for (const installment of installments) {
      if (installment.deleted_at) continue;
      await updateLocal("installments", { ...installment, invoice: invoiceId });
    }
    await load();
  }

  async function remove(id: string): Promise<void> {
    const existing = await db.transactions.get(id);
    if (!existing) return;
    await softDeleteLocal("transactions", id);
    if (existing.invoice) await recalcInvoice(existing.invoice);
    await load();
  }

  return { items, loading, load, create, createCardPurchase, update, updateCardPurchase, remove, findByExternalRef };
});
