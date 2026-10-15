import { describe, expect, it } from "vitest";
import type { LocalInvoice } from "@/db/schema";
import { pickVisibleInvoices } from "@/features/cards/invoice-list";

function invoice(reference_month: string, status: LocalInvoice["status"]): LocalInvoice {
  return {
    id: reference_month,
    household: "h1",
    sync_id: `s-${reference_month}`,
    credit_card: "card1",
    account: "acc1",
    reference_month,
    closing_date: `${reference_month}-04`,
    due_date: `${reference_month}-11`,
    total_cents: 0,
    paid_cents: 0,
    status,
    closed_at: null,
    paid_at: null,
    note: "",
    updated_by: null,
    deleted_at: null,
  };
}

describe("pickVisibleInvoices", () => {
  it("mostra a próxima a pagar e a seguinte (não as mais recentes)", () => {
    const invoices = [
      invoice("2026-10", "fechada"),
      invoice("2026-11", "aberta"),
      invoice("2026-12", "aberta"),
      invoice("2027-01", "aberta"),
    ];
    const visible = pickVisibleInvoices(invoices, false);
    expect(visible.map((item) => item.reference_month)).toEqual(["2026-10", "2026-11"]);
  });

  it("pula as pagas e mostra as duas próximas em aberto", () => {
    const invoices = [
      invoice("2026-09", "paga"),
      invoice("2026-10", "vencida"),
      invoice("2026-11", "aberta"),
      invoice("2026-12", "aberta"),
    ];
    const visible = pickVisibleInvoices(invoices, false);
    expect(visible.map((item) => item.reference_month)).toEqual(["2026-10", "2026-11"]);
  });

  it("completa com as últimas pagas quando não há duas em aberto", () => {
    const invoices = [
      invoice("2026-08", "paga"),
      invoice("2026-09", "paga"),
      invoice("2026-10", "paga"),
    ];
    const visible = pickVisibleInvoices(invoices, false);
    expect(visible.map((item) => item.reference_month)).toEqual(["2026-09", "2026-10"]);
  });

  it("expandido devolve todas, mais recentes primeiro", () => {
    const invoices = [
      invoice("2026-10", "fechada"),
      invoice("2026-11", "aberta"),
      invoice("2026-12", "aberta"),
    ];
    const visible = pickVisibleInvoices(invoices, true);
    expect(visible.map((item) => item.reference_month)).toEqual([
      "2026-12",
      "2026-11",
      "2026-10",
    ]);
  });
});
