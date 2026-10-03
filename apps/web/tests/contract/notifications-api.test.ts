import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsApi } from "@/api/notifications-api";
import { clearTokens, saveTokens } from "@/api/tokens";

interface Captured {
  url: string;
  init: RequestInit;
}

function mockFetch(body: unknown, status = 200): Captured[] {
  const captured: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      captured.push({ url, init });
      return Promise.resolve(
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
  return captured;
}

describe("notifications-api contract", () => {
  beforeEach(() => {
    saveTokens({ token: "jwt", refreshToken: "r" });
  });
  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
  });

  it("fetches the VAPID public key without auth", async () => {
    const captured = mockFetch({ public_key: "ABC" });
    const result = await notificationsApi.vapidPublicKey();
    expect(result.public_key).toBe("ABC");
    expect(captured[0]?.url).toContain("/notifications/vapid-public-key");
  });

  it("gets preferences", async () => {
    mockFetch({ push_enabled: false, preferences: { horario_envio: "08:30" } });
    const result = await notificationsApi.getPreferences();
    expect(result.push_enabled).toBe(false);
  });

  it("updates preferences with PUT", async () => {
    const captured = mockFetch({ push_enabled: true, preferences: {} });
    await notificationsApi.updatePreferences(
      {
        contas_a_pagar: { habilitado: true, dias_antes: [3] },
        contas_a_receber: { habilitado: false, dias_antes: [] },
        fatura_cartao: { habilitado: true, dias_antes: [1] },
        fixas_recorrentes: { habilitado: false, dias_antes: [] },
        horario_envio: "08:30",
        quiet_hours: { ativar: true, inicio: "22:00", fim: "07:00" },
      },
      true,
    );
    expect(captured[0]?.init.method).toBe("PUT");
    expect(captured[0]?.url).toContain("/notifications/preferences");
  });

  it("registers and revokes a subscription", async () => {
    const captured = mockFetch({ subscription: { id: "s1" } }, 201);
    const result = await notificationsApi.subscribe({
      endpoint: "https://push/e",
      keys: { p256dh: "k", auth: "a" },
    });
    expect(result.subscription.id).toBe("s1");
    expect(captured[0]?.url).toContain("/notifications/subscriptions");

    const del = mockFetch(undefined, 204);
    await notificationsApi.unsubscribe("s1");
    expect(del[0]?.init.method).toBe("DELETE");
  });
});
