import { describe, expect, it } from "vitest";
import {
  applyInvoicePayment,
  closingDateForMonth,
  dueDateForMonth,
  referenceMonthForPurchase,
  resolveInvoiceStatus,
} from "../src/domain/invoice";

describe("invoice cycle", () => {
  it("clamps closing day to month length", () => {
    expect(closingDateForMonth("2024-02", 31)).toBe("2024-02-29");
    expect(closingDateForMonth("2023-02", 31)).toBe("2023-02-28");
    expect(closingDateForMonth("2024-04", 31)).toBe("2024-04-30");
    expect(closingDateForMonth("2024-01", 15)).toBe("2024-01-15");
  });

  it("clamps due day to month length", () => {
    expect(dueDateForMonth("2024-02", 30)).toBe("2024-02-29");
  });

  it("uses an inclusive cutoff: purchase on closing day stays in the current invoice", () => {
    expect(referenceMonthForPurchase("2024-03-15", 15)).toBe("2024-03");
  });

  it("pushes purchase after the closing day to the next invoice", () => {
    expect(referenceMonthForPurchase("2024-03-16", 15)).toBe("2024-04");
  });

  it("handles a purchase on the clamped closing day of a leap February", () => {
    expect(referenceMonthForPurchase("2024-02-29", 31)).toBe("2024-02");
    expect(referenceMonthForPurchase("2024-03-01", 31)).toBe("2024-03");
  });

  it("rolls the year over when the closing day has passed in December", () => {
    expect(referenceMonthForPurchase("2024-12-20", 15)).toBe("2025-01");
  });

  it("resolves invoice status transitions", () => {
    expect(
      resolveInvoiceStatus({
        current: "aberta",
        closingDate: "2024-03-15",
        dueDate: "2024-03-25",
        today: "2024-03-10",
        paidCents: 0,
        totalCents: 1000,
      }),
    ).toBe("aberta");

    expect(
      resolveInvoiceStatus({
        current: "aberta",
        closingDate: "2024-03-15",
        dueDate: "2024-03-25",
        today: "2024-03-16",
        paidCents: 0,
        totalCents: 1000,
      }),
    ).toBe("fechada");

    expect(
      resolveInvoiceStatus({
        current: "fechada",
        closingDate: "2024-03-15",
        dueDate: "2024-03-25",
        today: "2024-03-26",
        paidCents: 0,
        totalCents: 1000,
      }),
    ).toBe("vencida");

    expect(
      resolveInvoiceStatus({
        current: "vencida",
        closingDate: "2024-03-15",
        dueDate: "2024-03-25",
        today: "2024-03-26",
        paidCents: 1000,
        totalCents: 1000,
      }),
    ).toBe("paga");
  });

  it("accumulates partial payments without touching the total", () => {
    const invoice = { total_cents: 1000, paid_cents: 0, status: "fechada" as const, paid_at: null };
    const first = applyInvoicePayment(invoice, 300, "2024-03-20T10:00:00.000Z");
    expect(first).toEqual({ paid_cents: 300, status: "fechada", paid_at: null });

    const second = applyInvoicePayment(
      { ...invoice, ...first },
      400,
      "2024-03-21T10:00:00.000Z",
    );
    expect(second).toEqual({ paid_cents: 700, status: "fechada", paid_at: null });

    const third = applyInvoicePayment({ ...invoice, ...second }, 300, "2024-03-22T10:00:00.000Z");
    expect(third.paid_cents).toBe(1000);
    expect(third.status).toBe("paga");
    expect(third.paid_at).toBe("2024-03-22T10:00:00.000Z");
  });

  it("marks a zero-total invoice as paid with any payment", () => {
    const result = applyInvoicePayment(
      { total_cents: 0, paid_cents: 0, status: "vencida", paid_at: null },
      1,
      "2024-03-22T10:00:00.000Z",
    );
    expect(result.status).toBe("paga");
  });
});
