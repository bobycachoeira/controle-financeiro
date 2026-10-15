import { pullResponseSchema, type PullResponse } from "@cf/shared";
import { apiClient } from "../api/client";
import { db, getMeta, setMeta } from "../db/schema";
import { applyRemote, removeLocal, type SyncableRecord } from "../db/repositories";

export interface PullSummary {
  serverSeq: number;
  hasMore: boolean;
  applied: number;
}

export function cursorKey(household: string): string {
  return `cursor:${household}`;
}

export async function getCursor(household: string): Promise<number> {
  const value = await getMeta(cursorKey(household));
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function pullChanges(household: string, limit = 200): Promise<PullSummary> {
  const since = await getCursor(household);
  const response = await apiClient.get<PullResponse>(
    `/sync/pull?since=${since}&limit=${limit}`,
  );
  const parsed = pullResponseSchema.parse(response);
  let applied = 0;

  for (const change of parsed.changes) {
    if (change.deleted || (change.record && change.record.deleted_at)) {
      await removeLocal(change.entity, change.id);
      continue;
    }
    if (change.record) {
      const record = { ...(change.record as unknown as SyncableRecord), id: change.id };
      await applyRemote(change.entity, record);
      applied += 1;
    }
  }

  await setMeta(cursorKey(household), String(parsed.server_seq));
  return { serverSeq: parsed.server_seq, hasMore: parsed.has_more, applied };
}

export async function resetCursor(household: string): Promise<void> {
  await db.meta.delete(cursorKey(household));
}

/**
 * Remove faturas locais que não existem mais no servidor (órfãs de creates
 * que falharam/foram descartados). Faturas com outbox pendente são mantidas.
 */
export async function reconcileOrphanInvoices(household: string): Promise<number> {
  const response = await apiClient.get<PullResponse>("/sync/pull?since=0&limit=2000");
  const parsed = pullResponseSchema.parse(response);
  const serverIds = new Set(
    parsed.changes.filter((change) => change.entity === "invoices").map((change) => change.id),
  );
  const local = await db.invoices.where("household").equals(household).toArray();
  let removed = 0;
  for (const invoice of local) {
    if (invoice._pendingOutboxId !== undefined) continue;
    if (serverIds.has(invoice.id)) continue;
    await db.invoices.delete(invoice.id);
    removed += 1;
  }
  return removed;
}
