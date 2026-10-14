import cron from "node-cron";
import webpush from "web-push";
import { budgetPeriodRange, computeBudgetUsage, notificationPreferencesSchema } from "@cf/shared";
import { hasVapid, loadConfig } from "./config.js";
import { PocketBaseClient } from "./pocketbase.js";
import { budgetAlertKey, highestBudgetThreshold } from "./budget.js";
import {
  buildReminderJobs,
  resolveSendWindow,
  type BillItem,
  type ExistingDelivery,
  type InvoiceItem,
  type PreferenceEntry,
  type ReminderJob,
} from "./schedule.js";
import {
  buildBudgetAlertPayload,
  buildImmediatePayload,
  sendReminder,
  type DeliveryStore,
  type PushTarget,
} from "./sender.js";

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
  category?: string | null;
}

interface BudgetRecord {
  id: string;
  household: string;
  name: string;
  period: "mensal" | "trimestral" | "anual";
  reference_month: string;
  total_cents: number;
  alert_pct: number;
  categories: Array<{ category: string; limit_cents?: number }>;
}

interface TransactionRecord {
  id: string;
  household: string;
  type: "receita" | "despesa" | "transferencia";
  status: "pago" | "a_pagar";
  amount_cents: number;
  category?: string | null;
  date: string;
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
  title?: string;
  amount_cents?: number;
  note?: string;
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

  async runOnce(): Promise<{
    jobs: number;
    sent: number;
    failed: number;
    immediate: number;
    budgetAlerts: number;
  }> {
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
    const budgets = await this.client.listAll<BudgetRecord>(
      "budgets",
      'active=true && deleted_at=""',
    );
    const transactions = await this.client.listAll<TransactionRecord>(
      "transactions",
      'deleted_at=""',
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

    const immediate = await this.processImmediate(targets);
    const budgetAlerts = await this.processBudgetAlerts({
      entries,
      targets,
      budgets,
      transactions,
      bills,
      now: { date, time },
    });
    return { jobs: jobs.length, sent, failed, immediate, budgetAlerts };
  }

  /** Alertas de orçamento (70/90/100%): 1 por limiar por período. */
  private async processBudgetAlerts(input: {
    entries: PreferenceEntry[];
    targets: Map<string, PushTarget[]>;
    budgets: BudgetRecord[];
    transactions: TransactionRecord[];
    bills: BillRecord[];
    now: { date: string; time: string };
  }): Promise<number> {
    let sent = 0;
    for (const entry of input.entries) {
      if (!entry.pushEnabled || entry.subscriptions <= 0) continue;
      const window = resolveSendWindow(
        { date: input.now.date, time: input.now.time },
        entry.preferences,
      );
      if (!window) continue;
      const list = input.targets.get(entry.userId) ?? [];
      if (list.length === 0) continue;
      const householdBudgets = input.budgets.filter(
        (budget) => budget.household === entry.household,
      );
      if (householdBudgets.length === 0) continue;
      const householdTransactions = input.transactions.filter(
        (tx) => tx.household === entry.household,
      );
      const householdBills = input.bills
        .filter((bill) => bill.household === entry.household)
        .map((bill) => ({
          nature: bill.nature,
          status: bill.status as "a_confirmar" | "pendente" | "pago" | "cancelado",
          amount_cents: bill.amount_cents,
          category: bill.category,
          due_date: bill.due_date,
        }));

      for (const budget of householdBudgets) {
        const range = budgetPeriodRange(budget.period, budget.reference_month);
        if (input.now.date < range.start || input.now.date > range.end) continue;
        const usage = computeBudgetUsage(budget, householdTransactions, householdBills);
        const threshold = highestBudgetThreshold(usage.percent);
        if (threshold === null) continue;
        const key = budgetAlertKey(budget.id, threshold, budget.reference_month);
        const existing = await this.client.listAll<DeliveryRecord>(
          "notification_deliveries",
          `user="${entry.userId}" && kind="orcamento" && entity_id="${key}"`,
        );
        if (existing.length > 0) continue;

        const created = await this.client.create<{ id: string }>("notification_deliveries", {
          household: entry.household,
          user: entry.userId,
          kind: "orcamento",
          entity: "budgets",
          entity_id: key,
          scheduled_date: new Date().toISOString(),
          title: budget.name,
          amount_cents: usage.spentCents,
          status: "pendente",
          attempts: 0,
        });
        const payload = buildBudgetAlertPayload({
          name: budget.name,
          threshold,
          spentCents: usage.spentCents,
          totalCents: budget.total_cents,
          budgetId: budget.id,
        });
        try {
          for (const target of list) await this.push.sendNotification(target, payload);
          await this.store.markSent(created.id);
          sent += 1;
        } catch (error) {
          await this.store.markFailed(
            created.id,
            error instanceof Error ? error.message : String(error),
          );
        }
      }
    }
    return sent;
  }

  /** Entrega imediata: notificação de teste e "pedir cobertura" do casal. */
  private async processImmediate(targets: Map<string, PushTarget[]>): Promise<number> {
    const pending = await this.client.listAll<DeliveryRecord>(
      "notification_deliveries",
      '(kind="teste" || kind="cobertura") && status="pendente"',
    );
    let count = 0;
    for (const record of pending) {
      const list = targets.get(record.user) ?? [];
      if (list.length === 0) {
        await this.store.markFailed(record.id, "no_subscription");
        continue;
      }
      const payload = buildImmediatePayload({
        kind: record.kind,
        title: record.title,
        amountCents: record.amount_cents,
        note: record.note,
      });
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
