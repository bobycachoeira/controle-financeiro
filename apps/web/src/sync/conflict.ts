import type { SyncEntityName } from "@cf/shared";
import { applyRemote, ENTITY_TABLES, type SyncableRecord } from "../db/repositories";

export interface ConflictEntry {
  entity: SyncEntityName;
  id: string;
  reason: string;
  serverRecord: SyncableRecord;
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
