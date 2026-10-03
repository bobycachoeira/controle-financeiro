import { db, type OutboxItem } from "../db/schema";

export async function listPending(): Promise<OutboxItem[]> {
  const items = await db.outbox
    .where("status")
    .anyOf("pending", "failed")
    .toArray();
  return items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function listFailed(): Promise<OutboxItem[]> {
  const items = await db.outbox.where("status").equals("failed").toArray();
  return items.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

export async function countPending(): Promise<number> {
  return db.outbox.where("status").anyOf("pending", "failed").count();
}

export async function discard(id: number): Promise<void> {
  await db.outbox.delete(id);
}

export async function countFailed(): Promise<number> {
  return db.outbox.where("status").equals("failed").count();
}

export async function headPending(limit = 50): Promise<OutboxItem[]> {
  const items = await listPending();
  return items.slice(0, limit);
}

export async function markSending(id: number): Promise<void> {
  await db.outbox.update(id, { status: "sending" });
}

export async function markDone(id: number): Promise<void> {
  await db.outbox.update(id, { status: "done", last_error: null });
}

export async function markFailed(id: number, error: string): Promise<void> {
  const item = await db.outbox.get(id);
  if (!item) return;
  await db.outbox.update(id, {
    status: "failed",
    attempts: (item.attempts ?? 0) + 1,
    last_error: error,
  });
}

export async function resetToPending(id: number): Promise<void> {
  await db.outbox.update(id, { status: "pending" });
}

export async function clearCompleted(): Promise<number> {
  return db.outbox.where("status").equals("done").delete();
}

export async function lastError(): Promise<string | null> {
  const failed = await db.outbox.where("status").equals("failed").toArray();
  if (failed.length === 0) return null;
  failed.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  return failed[0]?.last_error ?? null;
}
