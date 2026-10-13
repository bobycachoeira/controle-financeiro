import cron from "node-cron";
import webpush from "web-push";
import { notificationPreferencesSchema } from "@cf/shared";
import { hasVapid, loadConfig } from "./config.js";
import { PocketBaseClient } from "./pocketbase.js";
import {
  buildReminderJobs,
  type BillItem,
  type ExistingDelivery,
  type InvoiceItem,
  type PreferenceEntry,
  type ReminderJob,
} from "./schedule.js";
import { sendReminder, type DeliveryStore, type PushTarget } from "./sender.js";

interface PrefRecord {
  id: string;
  user: string;
  household: string;
  push_enabled: boolean;
  preferences: unknown;
}

interface SubRecord {
  id: string;
  user: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  revoked_at?: string;
}

interface BillRecord {
  id: string;
  household: string;
  title: string;
  amount_cents: number;
  due_date: string;
  emission_date?: string;
  nature: "entrada" | "saida";
  type: "fixa" | "variavel";
  periodicity: string;
  status: string;
}

interface InvoiceRecord {
  id: string;
  household: string;
  reference_month: string;
  due_date: string;
  total_cents: number;
  status: string;
}

interface DeliveryRecord {
  id: string;
  user: string;
  kind: string;
  entity: string;
  entity_id: string;
  status: string;
  scheduled_date: string;
}

function nowInTz(timezone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

function makeStore(client: PocketBaseClient): DeliveryStore {
  return {
    async claim(job: ReminderJob): Promise<string | null> {
      const filter =
        `user="${job.user}" && kind="${job.kind}" && entity="${job.entity}" && ` +
        `entity_id="${job.entityId}" && scheduled_date>="${job.scheduledDate} 00:00:00.000Z" && ` +
        `scheduled_date<="${job.scheduledDate} 23:59:59.999Z"`;
      const existing = await client.listAll<DeliveryRecord>("notification_deliveries", filter);
      if (existing.length > 0) return null;
      const created = await client.create<{ id: string }>("notification_deliveries", {
        household: job.household,
        user: job.user,
        kind: job.kind,
        entity: job.entity,
        entity_id: job.entityId,
        scheduled_date: `${job.scheduledDate} 12:00:00.000Z`,
        due_date: `${job.dueDate} 12:00:00.000Z`,
        title: job.title,
        amount_cents: job.amountCents,
        status: "pendente",
        attempts: 0,
      });
      return created.id;
    },
    async markSent(id: string): Promise<void> {
      await client.update("notification_deliveries", id, {
        status: "enviado",
        sent_at: new Date().toISOString(),
      });
    },
    async markFailed(id: string, error: string): Promise<void> {
      await client.update("notification_deliveries", id, {
        status: "falho",
        last_error: error.slice(0, 500),
      });
    },
  };
}

function targetsByUser(subscriptions: SubRecord[]): Map<string, PushTarget[]> {
  const map = new Map<string, PushTarget[]>();
  for (const sub of subscriptions) {
    if (sub.revoked_at) continue;
    const list = map.get(sub.user) ?? [];
    list.push({ endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth });
    map.set(sub.user, list);
  }
  return map;
}

export class Notifier {
  private readonly store: DeliveryStore;
  private readonly push = {
    sendNotification: (t: PushTarget, p: string) =>
      webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, p),
  };

  constructor(
    private readonly client: PocketBaseClient,
    private readonly timezone: string,
  ) {
    this.store = makeStore(client);
  }

  async runOnce(): Promise<{ jobs: number; sent: number; failed: number; tests: number }> {
    const { date, time } = nowInTz(this.timezone);
    const prefRecords = await this.client.listAll<PrefRecord>("notification_preferences");
    const subscriptions = await this.client.listAll<SubRecord>("push_subscriptions");
    const bills = await this.client.listAll<BillRecord>(
      "bills",
      '(status="pendente" || status="a_confirmar")',
    );
    const invoices = await this.client.listAll<InvoiceRecord>(
      "invoices",
      '(status="aberta" || status="fechada")',
    );
    const existingRecords = await this.client.listAll<DeliveryRecord>(
      "notification_deliveries",
      `scheduled_date>="${date} 00:00:00.000Z" && scheduled_date<="${date} 23:59:59.999Z"`,
    );

    const targets = targetsByUser(subscriptions);
    const entries: PreferenceEntry[] = prefRecords.map((record) => ({
      userId: record.user,
      household: record.household,
      pushEnabled: Boolean(record.push_enabled),
      preferences: notificationPreferencesSchema.parse(record.preferences || {}),
      subscriptions: (targets.get(record.user) ?? []).length,
    }));

    const existing: ExistingDelivery[] = existingRecords
      .filter((record) => record.kind !== "teste")
      .map((record) => ({
        user: record.user,
        kind: record.kind as ExistingDelivery["kind"],
        entity: record.entity,
        entityId: record.entity_id,
        scheduledDate: record.scheduled_date.slice(0, 10),
      }));

    const jobs = buildReminderJobs({
      today: date,
      nowTime: time,
      preferences: entries,
      bills: bills.map(toBillItem),
      invoices: invoices.map(toInvoiceItem),
      existing,
    });

    let sent = 0;
    let failed = 0;
    for (const job of jobs) {
      const result = await sendReminder(job, targets.get(job.user) ?? [], this.push, this.store);
      sent += result.sent;
      failed += result.failed;
    }

    const tests = await this.processTests(targets);
    return { jobs: jobs.length, sent, failed, tests };
  }

  private async processTests(targets: Map<string, PushTarget[]>): Promise<number> {
    const pending = await this.client.listAll<DeliveryRecord>(
      "notification_deliveries",
      'kind="teste" && status="pendente"',
    );
    let count = 0;
    for (const record of pending) {
      const list = targets.get(record.user) ?? [];
      if (list.length === 0) {
        await this.store.markFailed(record.id, "no_subscription");
        continue;
      }
      const job: ReminderJob = {
        user: record.user,
        household: "",
        kind: "contas_a_pagar",
        entity: "teste",
        entityId: record.id,
        dueDate: record.scheduled_date.slice(0, 10),
        title: "Notificação de teste",
        amountCents: 0,
        scheduledDate: record.scheduled_date.slice(0, 10),
      };
      const payload = JSON.stringify({ title: job.title, body: "Tudo pronto! Você receberá seus lembretes.", data: {} });
      try {
        for (const target of list) await this.push.sendNotification(target, payload);
        await this.store.markSent(record.id);
        count += 1;
      } catch (error) {
        await this.store.markFailed(record.id, error instanceof Error ? error.message : String(error));
      }
    }
    return count;
  }
}

function toBillItem(record: BillRecord): BillItem {
  return {
    id: record.id,
    household: record.household,
    title: record.title,
    amountCents: record.amount_cents,
    dueDate: record.due_date.slice(0, 10),
    emissionDate: record.emission_date ? record.emission_date.slice(0, 10) : undefined,
    nature: record.nature,
    type: record.type,
    periodicity: record.periodicity,
    status: record.status,
  };
}

function toInvoiceItem(record: InvoiceRecord): InvoiceItem {
  return {
    id: record.id,
    household: record.household,
    title: `Fatura ${record.reference_month}`,
    dueDate: record.due_date.slice(0, 10),
    totalCents: record.total_cents,
    status: record.status,
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (!hasVapid(config)) {
    console.error("VAPID keys ausentes (CF_VAPID_PUBLIC_KEY/CF_VAPID_PRIVATE_KEY).");
    process.exitCode = 1;
    return;
  }
  webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

  const client = new PocketBaseClient(config);
  await client.authenticate();
  const notifier = new Notifier(client, config.timezone);

  if (process.argv.includes("--once")) {
    const result = await notifier.runOnce();
    console.log(JSON.stringify({ event: "notifier.run", mode: "once", ...result }));
    return;
  }

  cron.schedule(config.cron, () => {
    notifier
      .runOnce()
      .then((result) => console.log(JSON.stringify({ event: "notifier.run", ...result })))
      .catch((error) => console.error(JSON.stringify({ event: "notifier.error", message: String(error) })));
  });
  console.log(JSON.stringify({ event: "notifier.started", cron: config.cron, timezone: config.timezone }));
}

if (process.env.VITEST !== "true") {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
