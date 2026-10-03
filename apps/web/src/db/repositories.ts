import type { SyncEntityName, SyncOperationType } from "@cf/shared";
import { db, type LocalMeta, type OutboxItem } from "./schema";

export type SyncableRecord = LocalMeta & {
  id: string;
  household: string;
  sync_id: string;
  deleted_at?: string | null;
  updated?: string;
};

export type EntityTable = {
  toArray: () => Promise<SyncableRecord[]>;
  get: (key: string) => Promise<SyncableRecord | undefined>;
  put: (record: SyncableRecord) => Promise<unknown>;
  delete: (key: string) => Promise<void>;
  where: (index: string) => {
    equals: (value: string) => {
      toArray: () => Promise<SyncableRecord[]>;
      delete: () => Promise<number>;
    };
  };
};

export const ENTITY_TABLES: Record<SyncEntityName, EntityTable> = {
  households: db.households as unknown as EntityTable,
  household_members: db.household_members as unknown as EntityTable,
  accounts: db.accounts as unknown as EntityTable,
  credit_cards: db.credit_cards as unknown as EntityTable,
  categories: db.categories as unknown as EntityTable,
  transactions: db.transactions as unknown as EntityTable,
  installments: db.installments as unknown as EntityTable,
  invoices: db.invoices as unknown as EntityTable,
  transfers: db.transfers as unknown as EntityTable,
  bills: db.bills as unknown as EntityTable,
  recurrences: db.recurrences as unknown as EntityTable,
  budgets: db.budgets as unknown as EntityTable,
  exchange_rates: db.exchange_rates as unknown as EntityTable,
};

export function nowISO(): string {
  return new Date().toISOString();
}

/**
 * Converte objetos reativos do Vue (Proxy) em valores simples, que o
 * IndexedDB consegue clonar. Sem isso, gravações com proxies falham com
 * DataCloneError.
 */
export function toPlain<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

export function newSyncId(): string {
  return crypto.randomUUID();
}

const LOCAL_ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function newLocalId(): string {
  let id = "";
  for (let index = 0; index < 15; index += 1) {
    id += LOCAL_ID_ALPHABET[Math.floor(Math.random() * LOCAL_ID_ALPHABET.length)];
  }
  return id;
}

export async function upsertLocal<T extends SyncableRecord>(
  entity: SyncEntityName,
  record: T,
): Promise<void> {
  await ENTITY_TABLES[entity].put(toPlain(record));
}

export async function applyRemote<T extends SyncableRecord>(
  entity: SyncEntityName,
  record: T,
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const existing = await table.get(record.id);
  const payload: SyncableRecord = { ...record };
  delete payload._dirty;
  delete payload._pendingOutboxId;
  if (existing?._pendingOutboxId) {
    payload._pendingOutboxId = existing._pendingOutboxId;
  }
  await table.put(toPlain(payload));
}

export async function removeLocal(entity: SyncEntityName, id: string): Promise<void> {
  await ENTITY_TABLES[entity].delete(id);
}

export interface EnqueueInput {
  entity: SyncEntityName;
  operation: SyncOperationType;
  household: string;
  record: SyncableRecord;
  payload: Record<string, unknown>;
}

export async function enqueue(input: EnqueueInput): Promise<number> {
  const item: OutboxItem = {
    sync_id: input.record.sync_id,
    household: input.household,
    entity: input.entity,
    operation: input.operation,
    entity_id: input.record.id,
    payload: toPlain(input.payload),
    client_ts: nowISO(),
    status: "pending",
    attempts: 0,
    last_error: null,
    created: nowISO(),
  };
  const id = await db.outbox.add(toPlain(item));
  const table = ENTITY_TABLES[input.entity];
  const existing = await table.get(input.record.id);
  if (existing) {
    await table.put(toPlain({ ...existing, _dirty: true, _pendingOutboxId: id }));
  }
  return id;
}

export async function createLocal<T extends SyncableRecord>(
  entity: SyncEntityName,
  record: T,
): Promise<T> {
  const dirty: T = { ...record, _dirty: true, deleted_at: null, updated: nowISO() };
  await ENTITY_TABLES[entity].put(toPlain(dirty));
  const outboxId = await enqueue({
    entity,
    operation: "create",
    household: record.household,
    record: dirty,
    payload: toPayload(dirty),
  });
  return { ...dirty, _pendingOutboxId: outboxId };
}

export async function updateLocal<T extends SyncableRecord>(
  entity: SyncEntityName,
  record: T,
): Promise<T> {
  const dirty: T = { ...record, _dirty: true, updated: nowISO() };
  await ENTITY_TABLES[entity].put(toPlain(dirty));
  const outboxId = await enqueue({
    entity,
    operation: "update",
    household: record.household,
    record: dirty,
    payload: toPayload(dirty),
  });
  return { ...dirty, _pendingOutboxId: outboxId };
}

export async function softDeleteLocal(
  entity: SyncEntityName,
  id: string,
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const existing = await table.get(id);
  if (!existing) return;
  const tombstone: SyncableRecord = { ...existing, deleted_at: nowISO(), updated: nowISO() };
  await table.put(toPlain(tombstone));
  await enqueue({
    entity,
    operation: "delete",
    household: existing.household,
    record: tombstone,
    payload: { id: existing.id, sync_id: existing.sync_id },
  });
}

export function toPayload(record: SyncableRecord): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (key.startsWith("_")) continue;
    payload[key] = value;
  }
  return payload;
}

export function isSoftDeleted(record: { deleted_at?: string | null }): boolean {
  return Boolean(record.deleted_at);
}
