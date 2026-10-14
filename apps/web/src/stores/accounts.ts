import { defineStore } from "pinia";
import { ref } from "vue";
import type { AccountType } from "@cf/shared";
import { db, type LocalAccount } from "../db/schema";
import {
  createLocal,
  newSyncId,
  removeLocal,
  softDeleteLocal,
  updateLocal,
  newLocalId,
} from "../db/repositories";
import { useSessionStore } from "./session";

export interface AccountInput {
  name: string;
  type: AccountType;
  initial_balance_cents: number;
  include_in_total?: boolean;
  color?: string | null;
  icon?: string | null;
  owner?: string;
}

export const useAccountsStore = defineStore("accounts", () => {
  const items = ref<LocalAccount[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.accounts.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all
      .filter((account) => !account.deleted_at)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name));
  }

  async function create(input: AccountInput): Promise<LocalAccount> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    const record: LocalAccount = {
      id: newLocalId(),
      household: session.currentHouseholdId,
      sync_id: newSyncId(),
      name: input.name,
      type: input.type,
      currency: "BRL",
      initial_balance_cents: input.initial_balance_cents,
      include_in_total: input.include_in_total ?? true,
      active: true,
      order: items.value.length,
      color: input.color ?? null,
      icon: input.icon ?? null,
      owner: input.owner ?? "indefinido",
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("accounts", record);
    await load();
    return record;
  }

  async function update(id: string, changes: Partial<AccountInput>): Promise<void> {
    const existing = await db.accounts.get(id);
    if (!existing) return;
    await updateLocal("accounts", { ...existing, ...changes });
    await load();
  }

  /** Move a conta uma posição na lista (reordena os `order` afetados). */
  async function move(id: string, direction: -1 | 1): Promise<void> {
    // Contas internas de cartão ficam na aba Cartões e não entram na ordenação.
    const list = items.value.filter((account) => account.type !== "cartao_credito");
    const index = list.findIndex((account) => account.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target]!, list[index]!];
    for (let position = 0; position < list.length; position += 1) {
      const account = list[position]!;
      if ((account.order ?? 0) === position) continue;
      const stored = await db.accounts.get(account.id);
      if (stored) await updateLocal("accounts", { ...stored, order: position });
    }
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("accounts", id);
    await load();
  }

  async function hardRemoveLocal(id: string): Promise<void> {
    await removeLocal("accounts", id);
    await load();
  }

  return { items, load, create, update, move, remove, hardRemoveLocal };
});
