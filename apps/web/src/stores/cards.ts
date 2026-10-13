import { defineStore } from "pinia";
import { ref } from "vue";
import {
  closingDateForMonth,
  dueDateForMonth,
  resolveInvoiceStatus,
  todayISO,
} from "@cf/shared";
import { db, type LocalCreditCard, type LocalInvoice } from "../db/schema";
import {
  createLocal,
  newSyncId,
  newLocalId,
  softDeleteLocal,
  updateLocal,
} from "../db/repositories";
import { useSessionStore } from "./session";
import { useAccountsStore } from "./accounts";

export interface CardInput {
  name: string;
  bank?: string;
  limit_cents: number;
  closing_day: number;
  due_day: number;
  account?: string;
  color?: string | null;
  payment_account?: string | null;
  owner?: string;
}

export const useCardsStore = defineStore("cards", () => {
  const cards = ref<LocalCreditCard[]>([]);
  const invoices = ref<LocalInvoice[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const allCards = await db.credit_cards.where("household").equals(session.currentHouseholdId).toArray();
    cards.value = allCards.filter((card) => !card.deleted_at);
    const allInvoices = await db.invoices.where("household").equals(session.currentHouseholdId).toArray();
    invoices.value = allInvoices
      .filter((invoice) => !invoice.deleted_at)
      .sort((a, b) => (a.reference_month < b.reference_month ? 1 : -1));
  }

  async function create(input: CardInput): Promise<LocalCreditCard> {
    const session = useSessionStore();
    const household = session.currentHouseholdId ?? "";
    const accountsStore = useAccountsStore();
    let accountId = input.account;
    if (!accountId) {
      const account = await accountsStore.create({
        name: `Cartão ${input.name}`,
        type: "cartao_credito",
        initial_balance_cents: 0,
        include_in_total: false,
      });
      accountId = account.id;
    }
    const card: LocalCreditCard = {
      id: newLocalId(),
      household,
      sync_id: newSyncId(),
      account: accountId,
      bank: input.bank ?? null,
      limit_cents: input.limit_cents,
      currency: "BRL",
      closing_day: input.closing_day,
      due_day: input.due_day,
      purchase_at_posting: false,
      uses_account_balance_for_invoice: false,
      active: true,
      color: input.color ?? null,
      payment_account: input.payment_account ?? null,
      owner: input.owner ?? "indefinido",
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("credit_cards", card);
    await load();
    await ensureMonthlyInvoices();
    return card;
  }

  async function update(id: string, changes: Partial<CardInput>): Promise<void> {
    const existing = await db.credit_cards.get(id);
    if (!existing) return;
    await updateLocal("credit_cards", {
      ...existing,
      bank: changes.bank ?? existing.bank,
      limit_cents: changes.limit_cents ?? existing.limit_cents,
      closing_day: changes.closing_day ?? existing.closing_day,
      due_day: changes.due_day ?? existing.due_day,
      color: changes.color ?? existing.color,
      payment_account: changes.payment_account ?? existing.payment_account,
      owner: changes.owner ?? existing.owner,
    });
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("credit_cards", id);
    await load();
  }

  function invoicesFor(cardId: string): LocalInvoice[] {
    return invoices.value.filter((invoice) => invoice.credit_card === cardId);
  }

  // Cria a fatura do mês de referência para cada cartão (mesmo com valor 0),
  // para permitir informar o valor na hora do pagamento.
  async function ensureMonthlyInvoices(referenceMonth = todayISO().slice(0, 7)): Promise<number> {
    const session = useSessionStore();
    const household = session.currentHouseholdId;
    if (!household) return 0;
    const today = todayISO();
    let created = 0;
    for (const card of cards.value) {
      const existing = await db.invoices
        .where("household")
        .equals(household)
        .filter(
          (invoice) =>
            !invoice.deleted_at &&
            invoice.credit_card === card.id &&
            invoice.reference_month === referenceMonth,
        )
        .first();
      if (existing) continue;
      const closing = closingDateForMonth(referenceMonth, card.closing_day);
      const due = dueDateForMonth(referenceMonth, card.due_day);
      const invoice: LocalInvoice = {
        id: newLocalId(),
        household,
        sync_id: newSyncId(),
        credit_card: card.id,
        account: card.account,
        reference_month: referenceMonth,
        closing_date: closing,
        due_date: due,
        total_cents: 0,
        paid_cents: 0,
        status: resolveInvoiceStatus({
          current: "aberta",
          closingDate: closing,
          dueDate: due,
          today,
          paidCents: 0,
          totalCents: 0,
        }),
        closed_at: null,
        paid_at: null,
        note: "",
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      };
      await createLocal("invoices", invoice);
      created += 1;
    }
    if (created > 0) await load();
    return created;
  }

  return { cards, invoices, load, create, update, remove, invoicesFor, ensureMonthlyInvoices };
});
