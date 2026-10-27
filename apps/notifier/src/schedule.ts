import type { NotificationPreferences, ReminderType } from "@cf/shared";
import { dueReminderDays, nextAllowedTime, minutesOfDay } from "@cf/shared";

export interface PreferenceEntry {
  userId: string;
  household: string;
  pushEnabled: boolean;
  preferences: NotificationPreferences;
  subscriptions: number;
}

export interface BillItem {
  id: string;
  household: string;
  title: string;
  amountCents: number;
  dueDate: string;
  nature: "entrada" | "saida";
  type: "fixa" | "variavel";
  periodicity: string;
  status: string;
  emissionDate?: string;
}

export interface InvoiceItem {
  id: string;
  household: string;
  title: string;
  dueDate: string;
  closingDate?: string;
  closedAt?: string;
  totalCents: number;
  status: string;
}

export interface ExistingDelivery {
  user: string;
  kind: ReminderType;
  entity: string;
  entityId: string;
  scheduledDate: string;
}

export interface ReminderJob {
  user: string;
  household: string;
  kind: ReminderType;
  entity: string;
  entityId: string;
  dueDate: string;
  title: string;
  amountCents: number;
  scheduledDate: string;
}

export interface BuildInput {
  today: string;
  nowTime: string;
  preferences: PreferenceEntry[];
  bills: BillItem[];
  invoices: InvoiceItem[];
  existing: ExistingDelivery[];
}

function billKind(bill: BillItem): ReminderType {
  if (bill.periodicity && bill.periodicity !== "unica") return "fixas_recorrentes";
  return bill.nature === "entrada" ? "contas_a_receber" : "contas_a_pagar";
}

function alreadyExists(existing: ExistingDelivery[], job: ReminderJob): boolean {
  return existing.some(
    (item) =>
      item.user === job.user &&
      item.kind === job.kind &&
      item.entity === job.entity &&
      item.entityId === job.entityId &&
      item.scheduledDate === job.scheduledDate,
  );
}

export function resolveSendWindow(
  now: { date: string; time: string },
  preferences: NotificationPreferences,
): { date: string; time: string } | null {
  const allowed = nextAllowedTime(preferences.horario_envio, preferences.quiet_hours, now.date);
  if (now.date < allowed.date) return null;
  if (now.date === allowed.date && minutesOfDay(now.time) < minutesOfDay(allowed.time)) return null;
  return allowed;
}

export function buildReminderJobs(input: BuildInput): ReminderJob[] {
  const jobs: ReminderJob[] = [];
  const billsByHousehold = new Map<string, BillItem[]>();
  for (const bill of input.bills) {
    const list = billsByHousehold.get(bill.household) ?? [];
    list.push(bill);
    billsByHousehold.set(bill.household, list);
  }
  const invoicesByHousehold = new Map<string, InvoiceItem[]>();
  for (const invoice of input.invoices) {
    const list = invoicesByHousehold.get(invoice.household) ?? [];
    list.push(invoice);
    invoicesByHousehold.set(invoice.household, list);
  }

  for (const entry of input.preferences) {
    if (!entry.pushEnabled || entry.subscriptions <= 0) continue;
    const window = resolveSendWindow(
      { date: input.today, time: input.nowTime },
      entry.preferences,
    );
    if (!window) continue;
    const scheduledDate = window.date;

    for (const bill of billsByHousehold.get(entry.household) ?? []) {
      if (bill.status === "a_confirmar") {
        const kind: ReminderType = bill.nature === "entrada" ? "contas_a_receber" : "contas_a_pagar";
        const config = entry.preferences[kind];
        if (!config?.habilitado) continue;
        const emission = bill.emissionDate ?? bill.dueDate;
        if (emission > window.date) continue;
        const job: ReminderJob = {
          user: entry.userId,
          household: entry.household,
          kind,
          entity: "bills",
          entityId: bill.id,
          dueDate: bill.dueDate,
          title: `Confirme o valor: ${bill.title}`,
          amountCents: 0,
          scheduledDate,
        };
        if (!alreadyExists(input.existing, job)) jobs.push(job);
        continue;
      }
      if (bill.status !== "pendente") continue;
      const kind = billKind(bill);
      const config = entry.preferences[kind];
      if (!config?.habilitado) continue;
      if (dueReminderDays(bill.dueDate, config.dias_antes, window.date) === null) continue;
      const job: ReminderJob = {
        user: entry.userId,
        household: entry.household,
        kind,
        entity: "bills",
        entityId: bill.id,
        dueDate: bill.dueDate,
        title: bill.title,
        amountCents: bill.amountCents,
        scheduledDate,
      };
      if (!alreadyExists(input.existing, job)) jobs.push(job);
    }

    for (const invoice of invoicesByHousehold.get(entry.household) ?? []) {
      if (invoice.status !== "aberta" && invoice.status !== "fechada") continue;
      const config = entry.preferences.fatura_cartao;
      if (!config?.habilitado) continue;
      // Faturas abertas ainda podem receber lançamentos: só lembre depois do fechamento.
      const closed =
        invoice.status === "fechada" ||
        Boolean(invoice.closedAt) ||
        Boolean(invoice.closingDate && window.date >= invoice.closingDate);
      if (!closed) continue;
      if (dueReminderDays(invoice.dueDate, config.dias_antes, window.date) === null) continue;
      const job: ReminderJob = {
        user: entry.userId,
        household: entry.household,
        kind: "fatura_cartao",
        entity: "invoices",
        entityId: invoice.id,
        dueDate: invoice.dueDate,
        title: invoice.title,
        amountCents: invoice.totalCents,
        scheduledDate,
      };
      if (!alreadyExists(input.existing, job)) jobs.push(job);
    }
  }

  jobs.sort((a, b) => (a.kind === "fatura_cartao" ? -1 : b.kind === "fatura_cartao" ? 1 : 0));
  return jobs;
}
