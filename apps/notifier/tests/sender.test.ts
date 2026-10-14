import { describe, expect, it } from "vitest";
import { buildImmediatePayload } from "../src/sender.js";

describe("buildImmediatePayload", () => {
  it("monta o pedido de cobertura com valor e recado", () => {
    const payload = JSON.parse(
      buildImmediatePayload({
        kind: "cobertura",
        title: "Paulo pediu uma cobertura",
        amountCents: 12345,
        note: "Segura o aluguel",
      }),
    ) as { title: string; body: string; data: { kind?: string } };
    expect(payload.title).toBe("Paulo pediu uma cobertura");
    expect(payload.body).toContain("123,45");
    expect(payload.body).toContain("Segura o aluguel");
    expect(payload.data.kind).toBe("cobertura");
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
