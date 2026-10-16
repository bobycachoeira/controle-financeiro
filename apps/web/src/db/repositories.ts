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
  goals: db.goals as unknown as EntityTable,
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
  options: { force?: boolean } = {},
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const existing = await table.get(record.id);
  if (!options.force && existing) {
    // Com alteração local ainda não concluída (pendente/enviando/falha), não
    // sobrescreve: o push decide (LWW) e o pull seguinte aplica o resultado.
    if (existing._pendingOutboxId !== undefined) return;
    const unfinished = await db.outbox
      .where("entity")
      .equals(entity)
      .filter((item) => item.entity_id === record.id && item.status !== "done")
      .first();
    if (unfinished) return;
  }
  const payload: SyncableRecord = { ...record };
  delete payload._dirty;
  delete payload._pendingOutboxId;
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

/** Avisa o sincronizador de que há trabalho novo na fila (dispara push com debounce). */
function notifyOutboxChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cf:outbox-change"));
  }
}

/**
 * Junta operações pendentes para o mesmo registro, evitando que um create
 * seguido de edições vire um lote com várias operações no mesmo item (o que
 * gera conflitos falsos no servidor). Só considera itens `pending` com
 * `attempts === 0`: itens já enviados (ou possivelmente enviados) não podem
 * ter o payload reescrito, pois o servidor é idempotente pelo sync_id.
 */
async function findCoalescable(entity: SyncEntityName, entityId: string): Promise<OutboxItem | undefined> {
  return db.outbox
    .where("entity")
    .equals(entity)
    .filter(
      (item) =>
        item.entity_id === entityId &&
        item.status === "pending" &&
        (item.attempts ?? 0) === 0,
    )
    .first();
}

export async function enqueue(input: EnqueueInput): Promise<number> {
  const existing = await findCoalescable(input.entity, input.record.id);
  if (existing?.id !== undefined) {
    if (existing.operation === "create" && input.operation === "delete") {
      // O create nunca chegou ao servidor; a exclusão local dispensa o envio.
      await db.outbox.delete(existing.id);
      const table = ENTITY_TABLES[input.entity];
      const record = await table.get(input.record.id);
      if (record) {
        const clean: SyncableRecord = { ...record, _dirty: false };
        delete clean._pendingOutboxId;
        await table.put(toPlain(clean));
      }
      notifyOutboxChange();
      return existing.id;
    }
    const merged: OutboxItem = {
      ...existing,
      operation: existing.operation === "create" ? "create" : input.operation,
      payload: toPlain(input.payload),
      client_ts: nowISO(),
      status: "pending",
      attempts: 0,
      last_error: null,
    };
    await db.outbox.put(toPlain(merged));
    const table = ENTITY_TABLES[input.entity];
    const record = await table.get(input.record.id);
    if (record) {
      await table.put(toPlain({ ...record, _dirty: true, _pendingOutboxId: existing.id }));
    }
    notifyOutboxChange();
    return existing.id;
  }
  const item: OutboxItem = {
    sync_id: newSyncId(),
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
  const record = await table.get(input.record.id);
  if (record) {
    await table.put(toPlain({ ...record, _dirty: true, _pendingOutboxId: id }));
  }
  notifyOutboxChange();
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

/**
 * Atualiza apenas o IndexedDB, sem enfileirar no outbox. Use para campos
 * derivados que o servidor recalcula sozinho (ex.: `total_cents` da fatura a
 * partir das transações) — reenviá-los só cria corrida de sincronização.
 */
export async function updateLocalOnly<T extends SyncableRecord>(
  entity: SyncEntityName,
  record: T,
): Promise<T> {
  const dirty: T = { ...record, _dirty: true, updated: nowISO() };
  await ENTITY_TABLES[entity].put(toPlain(dirty));
  return dirty;
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

/**
 * Limpa a pendência do registro. Com `expectedItemId`, só limpa se o item
 * atual ainda for o dono da pendência (evita apagar a marca de uma edição
 * mais nova que já está na fila).
 */
export async function clearPendingFlag(
  entity: SyncEntityName,
  id: string,
  expectedItemId?: number,
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const existing = await table.get(id);
  if (!existing) return;
  if (expectedItemId !== undefined && existing._pendingOutboxId !== expectedItemId) return;
  const clean: SyncableRecord = { ...existing, _dirty: false };
  delete clean._pendingOutboxId;
  await table.put(toPlain(clean));
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
