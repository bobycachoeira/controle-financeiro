import { describe, expect, it } from "vitest";
import {
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
});
