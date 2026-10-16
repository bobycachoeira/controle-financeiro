import type { SyncEntityName } from "@cf/shared";
import { db } from "../db/schema";
import { applyRemote, ENTITY_TABLES, toPlain, type SyncableRecord } from "../db/repositories";

export interface ConflictEntry {
  entity: SyncEntityName;
  id: string;
  reason: string;
  serverRecord: SyncableRecord;
  /** Payload local que perdeu o conflito (para permitir reaplicar). */
  clientPayload?: Record<string, unknown>;
  clientUpdatedAt?: string;
}

/** Salva os conflitos no IndexedDB para sobreviverem a recarregamentos. */
export async function saveConflicts(entries: ConflictEntry[]): Promise<void> {
  for (const entry of entries) {
    const existing = await db.conflicts
      .where("entity")
      .equals(entry.entity)
      .filter((row) => row.recordId === entry.id)
      .first();
    const row = {
      entity: entry.entity,
      recordId: entry.id,
      reason: entry.reason,
      serverRecord: toPlain(entry.serverRecord) as unknown as Record<string, unknown>,
      clientPayload: entry.clientPayload ? toPlain(entry.clientPayload) : undefined,
      clientUpdatedAt: entry.clientUpdatedAt,
      created: new Date().toISOString(),
    };
    if (existing?.id !== undefined) {
      await db.conflicts.update(existing.id, row);
    } else {
      await db.conflicts.add(row);
    }
  }
}

export async function loadConflicts(): Promise<ConflictEntry[]> {
  const rows = await db.conflicts.toArray();
  rows.sort((a, b) => (a.created < b.created ? 1 : -1));
  return rows.map((row) => ({
    entity: row.entity,
    id: row.recordId,
    reason: row.reason,
    serverRecord: row.serverRecord as unknown as SyncableRecord,
    clientPayload: row.clientPayload,
    clientUpdatedAt: row.clientUpdatedAt,
  }));
}

export async function deleteStoredConflict(entity: SyncEntityName, recordId: string): Promise<void> {
  await db.conflicts
    .where("entity")
    .equals(entity)
    .filter((row) => row.recordId === recordId)
    .delete();
}

export async function clearStoredConflicts(): Promise<void> {
  await db.conflicts.clear();
}

const META_FIELDS = new Set([
  "id",
  "household",
  "sync_id",
  "updated_by",
  "created",
  "updated",
  "deleted_at",
]);

function normalizeForDiff(value: unknown): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value.trim() : JSON.stringify(value);
  const date = text.match(/^\d{4}-\d{2}-\d{2}/);
  return date ? date[0] : text;
}

export interface ConflictFieldDiff {
  field: string;
  client: unknown;
  server: unknown;
}

/** Campos que diferem entre a versão do cliente (perdedora) e a do servidor. */
export function conflictDiff(entry: ConflictEntry): ConflictFieldDiff[] {
  const client = entry.clientPayload ?? {};
  const server = (entry.serverRecord ?? {}) as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(client), ...Object.keys(server)]);
  const diffs: ConflictFieldDiff[] = [];
  for (const field of keys) {
    if (META_FIELDS.has(field) || field.startsWith("_")) continue;
    if (normalizeForDiff(client[field]) !== normalizeForDiff(server[field])) {
      diffs.push({ field, client: client[field], server: server[field] });
    }
  }
  return diffs;
}

export async function applyServerState(
  entity: SyncEntityName,
  record: SyncableRecord,
): Promise<void> {
  // Conflito exige aplicar a versão do servidor mesmo com alteração pendente.
  await applyRemote(entity, record, { force: true });
}

export async function flagForReview(
  entity: SyncEntityName,
  id: string,
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const existing = await table.get(id);
  if (existing) await table.put({ ...existing, _review: true, _dirty: false });
}

export async function discardOrphan(entity: SyncEntityName, id: string): Promise<void> {
  const table = ENTITY_TABLES[entity];
  await table.delete(id);
}
