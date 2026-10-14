import { defineStore } from "pinia";
import { ref } from "vue";
import { computeAccountBalance, todayISO, type AccountLike } from "@cf/shared";
import { db, type LocalGoal } from "../db/schema";
import {
  createLocal,
  newLocalId,
  newSyncId,
  softDeleteLocal,
  updateLocal,
} from "../db/repositories";
import { useAccountsStore } from "./accounts";
import { useSessionStore } from "./session";
import { useTransfersStore } from "./transfers";

export interface GoalInput {
  name: string;
  target_cents: number;
  deadline?: string | null;
  color?: string | null;
  icon?: string | null;
  owner?: string;
}

export const useGoalsStore = defineStore("goals", () => {
  const items = ref<LocalGoal[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.goals.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((goal) => !goal.deleted_at)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async function create(input: GoalInput): Promise<LocalGoal> {
    const session = useSessionStore();
    const record: LocalGoal = {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      name: input.name,
      target_cents: input.target_cents,
      deadline: input.deadline ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      owner: input.owner ?? "indefinido",
      active: true,
      entries: [],
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("goals", record);
    await load();
    return record;
  }

  async function update(id: string, changes: Partial<GoalInput>): Promise<void> {
    const existing = await db.goals.get(id);
    if (!existing) return;
    await updateLocal("goals", { ...existing, ...changes } as LocalGoal);
    await load();
  }

  async function remove(id: string): Promise<void> {
    const goal = await db.goals.get(id);
    if (goal?.cofrinho_account) {
      const balance = await cofrinhoBalance(goal);
      if (balance !== 0) {
        throw new Error("Resgate o que está no cofrinho antes de excluir a meta.");
      }
    }
    await softDeleteLocal("goals", id);
    await load();
  }

  /** Saldo guardado no cofrinho da meta (0 quando não há movimentação). */
  async function cofrinhoBalance(goal: LocalGoal): Promise<number> {
    if (!goal.cofrinho_account) return 0;
    const account = await db.accounts.get(goal.cofrinho_account);
    if (!account || account.deleted_at) return 0;
    const transactions = await db.transactions
      .where("household")
      .equals(goal.household)
      .toArray();
    return computeAccountBalance(
      account as AccountLike,
      transactions as unknown as Parameters<typeof computeAccountBalance>[1],
    );
  }

  /** Cria (uma vez) a conta interna que guarda o dinheiro da meta. */
  async function ensureCofrinho(goal: LocalGoal): Promise<string> {
    if (goal.cofrinho_account) return goal.cofrinho_account;
    const accounts = useAccountsStore();
    const account = await accounts.create({
      name: `Cofrinho · ${goal.name}`,
      type: "outros",
      initial_balance_cents: 0,
      owner: goal.owner ?? "indefinido",
    });
    const stored = await db.goals.get(goal.id);
    if (stored) {
      await updateLocal("goals", { ...stored, cofrinho_account: account.id } as LocalGoal);
    }
    return account.id;
  }

  /**
   * Aporte na meta (valor negativo = resgate).
   * Com `accountId`, o dinheiro sai/entra da conta escolhida via transferência
   * para o cofrinho da meta; sem conta, apenas organiza (sem mover saldo).
   */
  async function addEntry(
    id: string,
    amountCents: number,
    note = "",
    date = todayISO(),
    accountId?: string | null,
  ): Promise<void> {
    const existing = await db.goals.get(id);
    if (!existing || amountCents === 0) return;

    let transferId: string | null = null;
    if (accountId) {
      const cofrinhoId = await ensureCofrinho(existing);
      const transfers = useTransfersStore();
      const transfer =
        amountCents > 0
          ? await transfers.create({
              source_account: accountId,
              destination_account: cofrinhoId,
              amount_cents: amountCents,
              date,
              description: `Meta · ${existing.name}`,
            })
          : await transfers.create({
              source_account: cofrinhoId,
              destination_account: accountId,
              amount_cents: -amountCents,
              date,
              description: `Meta · ${existing.name}`,
            });
      transferId = transfer.id;
    }

    const stored = await db.goals.get(id);
    if (!stored) return;
    const entry = {
      id: newLocalId(),
      amount_cents: amountCents,
      date,
      note: note.slice(0, 200),
      account: accountId ?? null,
      transfer: transferId,
    };
    await updateLocal("goals", {
      ...stored,
      entries: [...(stored.entries ?? []), entry],
    } as LocalGoal);
    await load();
  }

  return { items, load, create, update, remove, cofrinhoBalance, addEntry };
});
