import type { ReminderJob } from "./schedule.js";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSender {
  sendNotification(
    target: PushTarget,
    payload: string,
  ): Promise<unknown>;
}

export interface DeliveryStore {
  claim(job: ReminderJob): Promise<string | null>;
  markSent(id: string): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
}

export interface SendResult {
  sent: number;
  failed: number;
  skipped: boolean;
}

export function buildPayload(job: ReminderJob): string {
  const amount = (job.amountCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return JSON.stringify({
    title: job.title,
    body: `${amount} · vence em ${job.dueDate}`,
    data: { entity: job.entity, entityId: job.entityId, kind: job.kind },
  });
}

export async function sendReminder(
  job: ReminderJob,
  targets: PushTarget[],
  push: PushSender,
  store: DeliveryStore,
): Promise<SendResult> {
  if (targets.length === 0) return { sent: 0, failed: 0, skipped: true };
  const deliveryId = await store.claim(job);
  if (!deliveryId) return { sent: 0, failed: 0, skipped: true };

  const payload = buildPayload(job);
  let sent = 0;
  let failed = 0;
  for (const target of targets) {
    try {
      await push.sendNotification(target, payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      await store.markFailed(deliveryId, error instanceof Error ? error.message : String(error));
    }
  }
  if (sent > 0) {
    await store.markSent(deliveryId);
  } else if (failed > 0) {
    await store.markFailed(deliveryId, "all_targets_failed");
  }
  return { sent, failed, skipped: false };
}
