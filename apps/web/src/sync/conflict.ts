import type { SyncEntityName } from "@cf/shared";
import { applyRemote, ENTITY_TABLES, type SyncableRecord } from "../db/repositories";

export interface ConflictEntry {
  entity: SyncEntityName;
  id: string;
  reason: string;
  serverRecord: SyncableRecord;
  /** Payload local que perdeu o conflito (para permitir reaplicar). */
  clientPayload?: Record<string, unknown>;
  clientUpdatedAt?: string;
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
  await applyRemote(entity, record);
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
