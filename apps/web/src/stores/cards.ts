import { defineStore } from "pinia";
import { ref } from "vue";
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
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("credit_cards", card);
    await load();
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

  return { cards, invoices, load, create, update, remove, invoicesFor };
});
