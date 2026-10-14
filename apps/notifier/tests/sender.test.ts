import { describe, expect, it } from "vitest";
import { buildImmediatePayload, buildPayload } from "../src/sender.js";

describe("buildImmediatePayload", () => {
  it("monta o pedido de cobertura com valor e recado", () => {
    const payload = JSON.parse(
      buildImmediatePayload({
        kind: "cobertura",
        title: "Paulo pediu uma cobertura",
        amountCents: 12345,
        note: "Segura o aluguel",
      }),
    ) as { title: string; body: string; data: { kind?: string; url?: string } };
    expect(payload.title).toBe("Paulo pediu uma cobertura");
    expect(payload.body).toContain("123,45");
    expect(payload.body).toContain("Segura o aluguel");
    expect(payload.data.kind).toBe("cobertura");
    expect(payload.data.url).toBe("/settle");
  });

  it("usa o texto padrão quando não há título", () => {
    const payload = JSON.parse(buildImmediatePayload({ kind: "cobertura", amountCents: 100 })) as {
      title: string;
    };
    expect(payload.title).toBe("Seu par pediu uma cobertura");
  });

  it("mantém o texto da notificação de teste", () => {
    const payload = JSON.parse(buildImmediatePayload({ kind: "teste" })) as { title: string };
    expect(payload.title).toBe("Notificação de teste");
  });
});

describe("buildPayload (lembretes)", () => {
  const base = {
    user: "u1",
    household: "h1",
    entityId: "e1",
    dueDate: "2026-10-20",
    title: "Internet",
    amountCents: 9990,
    scheduledDate: "2026-10-20",
  };

  it("aponta para contas e faturas", () => {
    const bill = JSON.parse(
      buildPayload({ ...base, kind: "contas_a_pagar", entity: "bills" }),
    ) as { data: { url?: string } };
    expect(bill.data.url).toBe("/bills");

    const invoice = JSON.parse(
      buildPayload({ ...base, kind: "fatura_cartao", entity: "invoices" }),
    ) as { data: { url?: string } };
    expect(invoice.data.url).toBe("/cards");
  });
});
