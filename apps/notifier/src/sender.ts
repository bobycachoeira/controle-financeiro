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

export interface ImmediatePayloadInput {
  kind: string;
  title?: string;
  amountCents?: number;
  note?: string;
}

/** Payload das entregas imediatas criadas na hora (teste e "pedir cobertura"). */
export function buildImmediatePayload(input: ImmediatePayloadInput): string {
  if (input.kind === "cobertura") {
    const amount = ((input.amountCents ?? 0) / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
    const suffix = input.note ? ` · ${input.note}` : "";
    return JSON.stringify({
      title: input.title || "Seu par pediu uma cobertura",
      body: `${amount}${suffix} · toque para abrir o app`,
      data: { entity: "coverage", kind: "cobertura" },
    });
  }
  return JSON.stringify({
    title: "Notificação de teste",
    body: "Tudo pronto! Você receberá seus lembretes.",
    data: {},
  });
}

/** Payload do alerta de orçamento (70/90/100% do limite). */
export function buildBudgetAlertPayload(input: {
  name: string;
  threshold: number;
  spentCents: number;
  totalCents: number;
  budgetId: string;
}): string {
  const spent = (input.spentCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const total = (input.totalCents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return JSON.stringify({
    title: `${input.name}: ${input.threshold}% do orçamento`,
    body: `Usou ${spent} de ${total}`,
    data: { entity: "budgets", entityId: input.budgetId, kind: "orcamento" },
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
