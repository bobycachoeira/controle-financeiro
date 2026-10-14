import Dexie, { type Table } from "dexie";
import type {
  Account,
  Bill,
  Budget,
  Category,
  CreditCard,
  ExchangeRate,
  Goal,
  Household,
  HouseholdMember,
  Installment,
  Invoice,
  Recurrence,
  SyncEntityName,
  SyncOperationType,
  Transaction,
  Transfer,
} from "@cf/shared";

export interface LocalMeta {
  _dirty?: boolean;
  _pendingOutboxId?: number;
  _review?: boolean;
}

export type LocalAccount = Account & LocalMeta;
export type LocalCreditCard = CreditCard & LocalMeta;
export type LocalCategory = Category & LocalMeta;
export type LocalTransaction = Transaction & LocalMeta;
export type LocalInstallment = Installment & LocalMeta;
export type LocalInvoice = Invoice & LocalMeta;
export type LocalTransfer = Transfer & LocalMeta;
export type LocalBill = Bill & LocalMeta;
export type LocalHousehold = Household & LocalMeta;
export type LocalHouseholdMember = HouseholdMember & LocalMeta;
export type LocalRecurrence = Recurrence & LocalMeta;
export type LocalBudget = Budget & LocalMeta;
export type LocalGoal = Goal & LocalMeta;
export type LocalExchangeRate = ExchangeRate & LocalMeta;

export interface OutboxItem {
  id?: number;
  sync_id: string;
  household: string;
  entity: SyncEntityName;
  operation: SyncOperationType;
  entity_id?: string | null;
  payload: Record<string, unknown>;
  client_ts: string;
  status: "pending" | "sending" | "done" | "failed";
  attempts: number;
  last_error?: string | null;
  created: string;
}

export interface MetaRow {
  key: string;
  value: string;
}

export interface StoredConflict {
  id?: number;
  entity: SyncEntityName;
  recordId: string;
  reason: string;
  serverRecord: Record<string, unknown>;
  clientPayload?: Record<string, unknown>;
  clientUpdatedAt?: string;
  created: string;
}

export class CfDatabase extends Dexie {
  households!: Table<LocalHousehold, string>;
  household_members!: Table<LocalHouseholdMember, string>;
  accounts!: Table<LocalAccount, string>;
  credit_cards!: Table<LocalCreditCard, string>;
  categories!: Table<LocalCategory, string>;
  transactions!: Table<LocalTransaction, string>;
  installments!: Table<LocalInstallment, string>;
  invoices!: Table<LocalInvoice, string>;
  transfers!: Table<LocalTransfer, string>;
  bills!: Table<LocalBill, string>;
  recurrences!: Table<LocalRecurrence, string>;
  budgets!: Table<LocalBudget, string>;
  goals!: Table<LocalGoal, string>;
  exchange_rates!: Table<LocalExchangeRate, string>;
  outbox!: Table<OutboxItem, number>;
  meta!: Table<MetaRow, string>;
  conflicts!: Table<StoredConflict, number>;

  constructor(name = "cf") {
    super(name);
    this.version(1).stores({
      households: "id, household, sync_id, updated, deleted_at",
      household_members: "id, household, user, sync_id, updated, deleted_at",
      accounts: "id, household, type, sync_id, updated, deleted_at",
      credit_cards: "id, household, account, sync_id, updated, deleted_at",
      categories: "id, household, kind, group, system, sync_id, updated, deleted_at",
      transactions:
        "id, household, account, credit_card, category, date, status, type, invoice, transfer, sync_id, updated, deleted_at",
      installments: "id, household, root_transaction, invoice, expected_date, sync_id, updated, deleted_at",
      invoices: "id, household, credit_card, reference_month, status, sync_id, updated, deleted_at",
      transfers: "id, household, source_account, destination_account, date, sync_id, updated, deleted_at",
      bills: "id, household, type, nature, status, due_date, sync_id, updated, deleted_at",
      outbox: "++id, sync_id, household, entity, status, created",
      meta: "key",
    });
    this.version(2).stores({
      recurrences: "id, household, active, target, sync_id, updated, deleted_at",
      budgets: "id, household, period, active, sync_id, updated, deleted_at",
    });
    this.version(3).stores({
      exchange_rates: "id, household, currency, date, sync_id, updated, deleted_at",
    });
    this.version(4).stores({
      conflicts: "++id, entity, recordId",
    });
    this.version(5).stores({
      goals: "id, household, active, sync_id, updated, deleted_at",
    });
  }
}

export const db = new CfDatabase();

export function getMeta(key: string): Promise<string | undefined> {
  return db.meta.get(key).then((row) => row?.value);
}

export async function setMeta(key: string, value: string): Promise<void> {
  await db.meta.put({ key, value });
}
