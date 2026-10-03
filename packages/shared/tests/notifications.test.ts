import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  dueReminderDays,
  isDeliveryDuplicate,
  isQuietHours,
  nextAllowedTime,
  notificationPreferencesSchema,
  reminderTitle,
  validateReminderDays,
} from "../src/domain/notifications";

describe("notification preferences", () => {
  it("applies safe defaults", () => {
    const parsed = notificationPreferencesSchema.parse({});
    expect(parsed.horario_envio).toBe("08:30");
    expect(parsed.quiet_hours).toEqual({ ativar: true, inicio: "22:00", fim: "07:00" });
    expect(DEFAULT_NOTIFICATION_PREFERENCES.fatura_cartao.habilitado).toBe(true);
  });

  it("rejects an invalid time", () => {
    expect(notificationPreferencesSchema.safeParse({ horario_envio: "25:00" }).success).toBe(false);
  });

  it("filters days-before to the allowed set and sorts desc", () => {
    expect(validateReminderDays("fatura_cartao", [1, 99, 3, 3, 5])).toEqual([5, 3, 1]);
  });
});

describe("quiet hours", () => {
  it("detects quiet hours crossing midnight", () => {
    const quiet = { ativar: true, inicio: "22:00", fim: "07:00" };
    expect(isQuietHours("23:30", quiet)).toBe(true);
    expect(isQuietHours("06:00", quiet)).toBe(true);
    expect(isQuietHours("12:00", quiet)).toBe(false);
  });

  it("detects same-day quiet hours", () => {
    const quiet = { ativar: true, inicio: "13:00", fim: "15:00" };
    expect(isQuietHours("14:00", quiet)).toBe(true);
    expect(isQuietHours("15:00", quiet)).toBe(false);
  });

  it("returns the preferred time when not in quiet hours", () => {
    const result = nextAllowedTime("08:30", { ativar: true, inicio: "22:00", fim: "07:00" });
    expect(result.time).toBe("08:30");
  });

  it("delays to the end of quiet hours and rolls to the next day when needed", () => {
    const result = nextAllowedTime("23:00", { ativar: true, inicio: "22:00", fim: "07:00" });
    expect(result.time).toBe("07:00");
  });
});

describe("due reminders and dedup", () => {
  it("matches due date minus N days", () => {
    expect(dueReminderDays("2024-03-13", [3, 1], "2024-03-10")).toBe(3);
    expect(dueReminderDays("2024-03-13", [1], "2024-03-10")).toBeNull();
  });

  it("ignores overdue dates", () => {
    expect(dueReminderDays("2024-03-01", [1], "2024-03-10")).toBeNull();
  });

  it("detects duplicates by composite key", () => {
    const existing = [
      {
        user: "u1",
        kind: "contas_a_pagar" as const,
        entity: "bills",
        entityId: "b1",
        scheduledDate: "2024-03-10",
      },
    ];
    expect(
      isDeliveryDuplicate(existing, {
        user: "u1",
        kind: "contas_a_pagar",
        entity: "bills",
        entityId: "b1",
        scheduledDate: "2024-03-10",
      }),
    ).toBe(true);
    expect(
      isDeliveryDuplicate(existing, {
        user: "u1",
        kind: "contas_a_pagar",
        entity: "bills",
        entityId: "b1",
        scheduledDate: "2024-03-11",
      }),
    ).toBe(false);
  });

  it("builds a descriptive title", () => {
    expect(reminderTitle("fatura_cartao", "Nubank", "2024-03-25")).toContain("Fatura de cartão");
  });
});
