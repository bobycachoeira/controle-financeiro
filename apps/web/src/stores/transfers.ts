import { defineStore } from "pinia";
import { ref } from "vue";
import { buildTransferTransactions, validateTransfer } from "@cf/shared";
import { db, type LocalTransfer } from "../db/schema";
import { createLocal, newSyncId, softDeleteLocal, newLocalId } from "../db/repositories";
import { useSessionStore } from "./session";

export interface TransferInput {
  source_account: string;
  destination_account: string;
  amount_cents: number;
  date: string;
  description?: string;
}

export const useTransfersStore = defineStore("transfers", () => {
  const items = ref<LocalTransfer[]>([]);

  async function load(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const all = await db.transfers.where("household").equals(session.currentHouseholdId).toArray();
    items.value = all.filter((transfer) => !transfer.deleted_at);
  }

  async function create(input: TransferInput): Promise<void> {
    const validation = validateTransfer(input);
    if (!validation.valid) {
      throw new Error(
        validation.error === "same_account"
          ? "Origem e destino devem ser diferentes."
          : "Valor inválido.",
      );
    }
    const session = useSessionStore();
    const household = session.currentHouseholdId ?? "";
    const transfer: LocalTransfer = {
      id: newLocalId(),
      household,
      sync_id: newSyncId(),
      source_account: input.source_account,
      destination_account: input.destination_account,
      amount_cents: input.amount_cents,
      currency: "BRL",
      date: input.date,
      description: input.description ?? "Transferência",
      source_transaction: null,
      destination_transaction: null,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    };
    await createLocal("transfers", transfer);

    const generated = buildTransferTransactions({ ...input, id: transfer.id, household });
    for (const entry of generated) {
      await createLocal("transactions", {
        id: newLocalId(),
        household,
        sync_id: newSyncId(),
        account: entry.account,
        credit_card: null,
        amount_cents: entry.amount_cents,
        currency: "BRL",
        type: "transferencia",
        date: entry.date,
        posting_date: null,
        attribution: "indefinido",
        payer_user: session.user?.id ?? null,
        category: null,
        description: entry.description,
        status: "pago",
        recurrence: null,
        installment: null,
        invoice: null,
        transfer: transfer.id,
        attachment: null,
        tags: [],
        note: "",
        updated_by: session.user?.id ?? null,
        deleted_at: null,
      });
    }
    await load();
  }

  async function remove(id: string): Promise<void> {
    await softDeleteLocal("transfers", id);
    await load();
  }

  return { items, load, create, remove };
});
