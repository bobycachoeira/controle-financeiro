import {
  pushResponseSchema,
  type OperationResult,
  type PushResponse,
  type SyncEntityName,
  type SyncOperationItem,
} from "@cf/shared";
import { apiClient } from "../api/client";
import { db, type OutboxItem } from "../db/schema";
import { ENTITY_TABLES, type SyncableRecord } from "../db/repositories";
import { applyServerState, flagForReview, type ConflictEntry } from "./conflict";
import { headPending, markDone, markFailed } from "./outbox";

export interface PushSummary {
  applied: number;
  conflict: number;
  ignored: number;
  error: number;
  serverSeq: number;
  conflicts: ConflictEntry[];
}

function toOperation(item: OutboxItem): SyncOperationItem {
  return {
    sync_id: item.sync_id,
    entity: item.entity,
    operation: item.operation,
    entity_id: item.entity_id ?? null,
    payload: item.payload,
    client_ts: item.client_ts,
  };
}

async function rekeyLocal(
  entity: SyncEntityName,
  syncId: string,
  remoteId: string,
): Promise<void> {
  const table = ENTITY_TABLES[entity];
  const all = await table.toArray();
  const local = all.find((record) => record.sync_id === syncId);
  if (!local) return;
  await table.delete(local.id);
  await table.put({ ...local, id: remoteId, _dirty: false, _pendingOutboxId: undefined });
}

async function handleResult(
  result: OperationResult,
  item: OutboxItem,
  conflicts: ConflictEntry[],
): Promise<void> {
  if (!item.id) return;
  switch (result.status) {
    case "applied": {
      if (item.operation === "create" && result.remote_id) {
        await rekeyLocal(item.entity, item.sync_id, result.remote_id);
      }
      await markDone(item.id);
      break;
    }
    case "conflict": {
      if (result.record) {
        const record = result.record as unknown as SyncableRecord;
        await applyServerState(item.entity, record);
        conflicts.push({
          entity: item.entity,
          id: record.id,
          reason: result.code ?? "conflict_kept_server",
          serverRecord: record,
        });
      }
      if (item.entity_id) await flagForReview(item.entity, item.entity_id);
      await markDone(item.id);
      break;
    }
    case "ignored": {
      await markDone(item.id);
      break;
    }
    case "error": {
      await markFailed(item.id, result.message ?? result.code ?? "sync_error");
      break;
    }
  }
}

export async function pushOutbox(household: string): Promise<PushSummary> {
  const items = await headPending(50);
  const summary: PushSummary = {
    applied: 0,
    conflict: 0,
    ignored: 0,
    error: 0,
    serverSeq: 0,
    conflicts: [],
  };
  if (items.length === 0) return summary;

  const response = await apiClient.post<PushResponse>("/sync/push", {
    household,
    operations: items.map(toOperation),
  });
  const parsed = pushResponseSchema.parse(response);
  summary.serverSeq = parsed.server_seq;

  const bySyncId = new Map(items.map((item) => [item.sync_id, item]));
  for (const result of parsed.results) {
    summary[result.status] += 1;
    const item = bySyncId.get(result.sync_id);
    if (item) await handleResult(result, item, summary.conflicts);
  }
  return summary;
}

export async function pendingOutboxCount(): Promise<number> {
  return db.outbox.where("status").anyOf("pending", "failed").count();
}
