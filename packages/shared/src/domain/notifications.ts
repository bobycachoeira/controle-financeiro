import { z } from "zod";

export const REMINDER_TYPES = [
  "contas_a_pagar",
  "contas_a_receber",
  "fatura_cartao",
  "fixas_recorrentes",
] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

export const REMINDER_DAYS_OPTIONS: Record<ReminderType, readonly number[]> = {
  contas_a_pagar: [1, 2, 3, 5, 7, 15, 30],
  contas_a_receber: [1, 2, 3, 5, 7, 15, 30],
  fatura_cartao: [1, 3, 5, 7, 10, 15],
  fixas_recorrentes: [1, 2, 3, 5, 7],
};

const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);

const reminderTypeSchema = z.object({
  habilitado: z.boolean(),
  dias_antes: z.array(z.number().int().min(0)).default([]),
});

export const quietHoursSchema = z.object({
  ativar: z.boolean().default(true),
  inicio: hhmm.default("22:00"),
  fim: hhmm.default("07:00"),
});

export const notificationPreferencesSchema = z.object({
  contas_a_pagar: reminderTypeSchema.default({ habilitado: true, dias_antes: [3, 1] }),
  contas_a_receber: reminderTypeSchema.default({ habilitado: false, dias_antes: [] }),
  fatura_cartao: reminderTypeSchema.default({ habilitado: true, dias_antes: [7, 3, 1] }),
  fixas_recorrentes: reminderTypeSchema.default({ habilitado: true, dias_antes: [3] }),
  horario_envio: hhmm.default("08:30"),
  quiet_hours: quietHoursSchema.default({ ativar: true, inicio: "22:00", fim: "07:00" }),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences =
  notificationPreferencesSchema.parse({});

export function validateReminderDays(
  type: ReminderType,
  days: readonly number[],
): number[] {
  const allowed = REMINDER_DAYS_OPTIONS[type];
  const unique = [...new Set(days)].filter((day) => allowed.includes(day));
  return unique.sort((a, b) => b - a);
}

export function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function isQuietHours(time: string, quiet: NotificationPreferences["quiet_hours"]): boolean {
  if (!quiet.ativar) return false;
  const current = minutesOfDay(time);
  const start = minutesOfDay(quiet.inicio);
  const end = minutesOfDay(quiet.fim);
  if (start === end) return false;
  if (start < end) return current >= start && current < end;
  return current >= start || current < end;
}

export interface DateTimeParts {
  date: string;
  time: string;
}

export function nextAllowedTime(
  preferred: string,
  quiet: NotificationPreferences["quiet_hours"],
  referenceToday?: string,
): DateTimeParts {
  const today = referenceToday ?? new Date().toISOString().slice(0, 10);
  if (!isQuietHours(preferred, quiet)) {
    return { date: today, time: preferred };
  }
  const start = minutesOfDay(quiet.inicio);
  const end = minutesOfDay(quiet.fim);
  const current = minutesOfDay(preferred);
  const crossesMidnight = start > end;
  const delayToNextDay = crossesMidnight && current >= start;
  const date = new Date(`${today}T00:00:00Z`);
  if (delayToNextDay) date.setUTCDate(date.getUTCDate() + 1);
  return { date: date.toISOString().slice(0, 10), time: quiet.fim };
}

export function dueReminderDays(
  dueDate: string,
  diasAntes: readonly number[],
  today: string,
): number | null {
  const due = Date.parse(`${dueDate}T00:00:00Z`);
  const now = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(due) || Number.isNaN(now)) return null;
  const diff = Math.round((due - now) / 86_400_000);
  if (diff < 0) return null;
  return diasAntes.includes(diff) ? diff : null;
}

export interface DeliveryKey {
  user: string;
  kind: ReminderType;
  entity: string;
  entityId: string;
  scheduledDate: string;
}

export function deliveryKey(key: DeliveryKey): string {
  return [key.user, key.kind, key.entity, key.entityId, key.scheduledDate].join("|");
}

export function isDeliveryDuplicate(
  existing: readonly DeliveryKey[],
  candidate: DeliveryKey,
): boolean {
  const target = deliveryKey(candidate);
  return existing.some((item) => deliveryKey(item) === target);
}

export function reminderTitle(kind: ReminderType, label: string, dueDate: string): string {
  const prefix: Record<ReminderType, string> = {
    contas_a_pagar: "Conta a pagar",
    contas_a_receber: "Conta a receber",
    fatura_cartao: "Fatura de cartão",
    fixas_recorrentes: "Conta fixa",
  };
  return `${prefix[kind]}: ${label} (vence ${dueDate})`;
}
