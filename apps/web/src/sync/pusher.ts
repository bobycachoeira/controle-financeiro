import {
  pushResponseSchema,
  type OperationResult,
  type PushResponse,
  type SyncEntityName,
  type SyncOperationItem,
} from "@cf/shared";
import { apiClient } from "../api/client";
import { db, type OutboxItem } from "../db/schema";
import {
  clearPendingFlag,
  ENTITY_TABLES,
  newSyncId,
  removeLocal,
  type SyncableRecord,
} from "../db/repositories";
import { applyServerState, flagForReview, type ConflictEntry } from "./conflict";
import { headPending, markDone, markFailed, markSending } from "./outbox";

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
  localId: string,
  remoteId: string,
  itemId?: number,
): Promise<void> {
  if (!localId) return;
  const table = ENTITY_TABLES[entity];
  const local = await table.get(localId);
  if (!local) return;
  await table.delete(localId);
  const rekeyed: SyncableRecord = { ...local, id: remoteId };
  // Só limpa a pendência se ela for deste item; uma edição mais nova na fila
  // precisa continuar marcada para o pull não sobrescrevê-la.
  if (itemId === undefined || local._pendingOutboxId === itemId) {
    rekeyed._dirty = false;
    delete rekeyed._pendingOutboxId;
  }
  await table.put(rekeyed);
}

/**
 * O servidor já tinha um registro equivalente (ex.: fatura do mesmo cartão/mês
 * criada por outro aparelho). Troca a cópia local pela versão do servidor —
 * ou remove, se no servidor ela já estiver excluída (ciclo fechado).
 */
async function mergeDuplicate(
  entity: SyncEntityName,
  localId: string | null | undefined,
  record: SyncableRecord,
): Promise<void> {
  if (localId) await removeLocal(entity, localId);
  if (record.deleted_at) return;
  await applyServerState(entity, record);
}

async function handleResult(
  result: OperationResult,
  item: OutboxItem,
  conflicts: ConflictEntry[],
): Promise<void> {
  if (!item.id) return;
  if (result.status === "applied") {
    // O item pode ter sido editado durante o envio: o payload novo não foi.
    // Reenvia (create vira update, para não esbarrar na idempotência).
    const current = await db.outbox.get(item.id);
    if (current && JSON.stringify(current.payload) !== JSON.stringify(item.payload)) {
      await db.outbox.update(item.id, {
        status: "pending",
        sync_id: item.operation === "create" ? newSyncId() : item.sync_id,
        operation: item.operation === "create" ? "update" : item.operation,
        attempts: 0,
        last_error: null,
      });
      return;
    }
  }
  switch (result.status) {
    case "applied": {
      if (result.code === "duplicate_merged" && result.record) {
        const record = {
          ...(result.record as unknown as SyncableRecord),
          id: result.remote_id ?? String((result.record as Record<string, unknown>).id ?? ""),
        };
        if (record.id) await mergeDuplicate(item.entity, item.entity_id, record);
      } else if (item.operation === "create" && result.remote_id) {
        await rekeyLocal(item.entity, item.entity_id ?? "", result.remote_id, item.id);
      } else if (item.entity_id) {
        // Enviado com sucesso: libera o registro para o pull aplicar o estado final.
        await clearPendingFlag(item.entity, item.entity_id, item.id);
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
          clientPayload: item.payload,
          clientUpdatedAt: item.client_ts,
        });
      }
      if (item.entity_id) await flagForReview(item.entity, item.entity_id);
      await markDone(item.id);
      break;
    }
    case "ignored": {
      if (item.entity_id) await clearPendingFlag(item.entity, item.entity_id, item.id);
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

  // Marca como `sending` antes de enviar: novas edições locais não podem
  // coalescer neste lote (o payload em voo já pode ter sido aplicado).
  for (const item of items) {
    if (item.id !== undefined) await markSending(item.id);
  }
  // Relê a fila: um coalesce que chegou entre a leitura e o envio pode ter
  // mudado o payload — o que vai na requisição é o estado mais novo.
  const sending = (
    await Promise.all(
      items.map((item) => (item.id === undefined ? undefined : db.outbox.get(item.id))),
    )
  ).filter((item): item is OutboxItem => Boolean(item && item.status === "sending"));
  if (sending.length === 0) return summary;

  let response: PushResponse;
  try {
    response = await apiClient.post<PushResponse>("/sync/push", {
      household,
      operations: sending.map(toOperation),
    });
  } catch (error) {
    for (const item of sending) {
      if (item.id !== undefined) await markFailed(item.id, "network_error");
    }
    throw error;
  }
  const parsed = pushResponseSchema.parse(response);
  summary.serverSeq = parsed.server_seq;

  const bySyncId = new Map(sending.map((item) => [item.sync_id, item]));
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
