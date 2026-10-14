import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createUser,
  operation,
  push,
  setupFamily,
  startHarness,
  type Family,
  type Harness,
} from "./harness";

function subscription(endpoint: string) {
  return { endpoint, keys: { p256dh: "p256dh-key", auth: "auth-secret" }, label: "Teste" };
}

describe("notifications", () => {
  let harness: Harness;
  let family: Family;
  let other: Family;

  beforeAll(async () => {
    harness = await startHarness();
    family = await setupFamily(harness, "notif@example.com", "Notif");
    other = await setupFamily(harness, "other@example.com", "Other");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("returns default preferences and push disabled initially", async () => {
    const result = await api<{ push_enabled: boolean; preferences: Record<string, unknown> }>(
      harness,
      "/api/notifications/preferences",
      { token: family.token },
    );
    expect(result.status).toBe(200);
    expect(result.data.push_enabled).toBe(false);
    expect((result.data.preferences as { horario_envio: string }).horario_envio).toBe("08:30");
  });

  it("validates and persists preferences", async () => {
    const invalid = await api(harness, "/api/notifications/preferences", {
      token: family.token,
      method: "PUT",
      body: { preferences: { horario_envio: "25:99" } },
    });
    expect(invalid.status).toBe(400);

    const valid = await api<{ preferences: { horario_envio: string; fatura_cartao: { dias_antes: number[] } } }>(
      harness,
      "/api/notifications/preferences",
      {
        token: family.token,
        method: "PUT",
        body: {
          preferences: {
            horario_envio: "07:15",
            fatura_cartao: { habilitado: true, dias_antes: [15, 3, 3, 99] },
          },
        },
      },
    );
    expect(valid.status).toBe(200);
    expect(valid.data.preferences.horario_envio).toBe("07:15");
    expect(valid.data.preferences.fatura_cartao.dias_antes).toEqual([15, 3]);
  });

  it("registers a subscription and marks push enabled", async () => {
    const created = await api<{ subscription: { id: string } }>(
      harness,
      "/api/notifications/subscriptions",
      { token: family.token, body: subscription("https://push.example/abc") },
    );
    expect(created.status).toBe(201);

    const prefs = await api<{ push_enabled: boolean; subscriptions_count: number }>(
      harness,
      "/api/notifications/preferences",
      { token: family.token },
    );
    expect(prefs.data.push_enabled).toBe(true);
    expect(prefs.data.subscriptions_count).toBe(1);
  });

  it("enqueues a test notification and lists deliveries", async () => {
    const test = await api<{ delivery_id: string }>(harness, "/api/notifications/test", {
      token: family.token,
      body: {},
    });
    expect(test.status).toBe(202);

    const deliveries = await api<{ items: Array<{ status: string; kind: string }> }>(
      harness,
      "/api/notifications/deliveries",
      { token: family.token },
    );
    expect(deliveries.data.items.some((item) => item.kind === "teste" && item.status === "pendente")).toBe(
      true,
    );
  });

  it("prevents deleting another user's subscription", async () => {
    const created = await api<{ subscription: { id: string } }>(
      harness,
      "/api/notifications/subscriptions",
      { token: family.token, body: subscription("https://push.example/def") },
    );
    const denied = await api(
      harness,
      `/api/notifications/subscriptions/${created.data.subscription.id}`,
      { token: other.token, method: "DELETE", body: {} },
    );
    expect(denied.status).toBe(403);

    const removed = await api(harness, `/api/notifications/subscriptions/${created.data.subscription.id}`, {
      token: family.token,
      method: "DELETE",
      body: {},
    });
    expect(removed.status).toBe(204);
  });

  it("discards pending deliveries when a bill is paid", async () => {
    const billLocalId = crypto.randomUUID();
    const billSyncId = crypto.randomUUID();
    const created = await push(harness, family.token, family.householdId, [
      operation(
        billSyncId,
        "bills",
        "create",
        {
          id: billLocalId,
          household: "",
          sync_id: billSyncId,
          title: "Internet",
          amount_cents: 10000,
          type: "variavel",
          nature: "saida",
          due_date: "2024-03-13",
          periodicity: "unica",
          status: "pendente",
          attribution: "ambos",
        },
        billLocalId,
      ),
    ]);
    const billId = String(created.data.results[0]?.remote_id ?? "");

    const delivery = await api<{ id: string; status: string }>(
      harness,
      "/api/collections/notification_deliveries/records",
      {
        token: harness.adminToken,
        body: {
          household: family.householdId,
          user: family.userId,
          kind: "contas_a_pagar",
          entity: "bills",
          entity_id: billId,
          scheduled_date: "2024-03-10 12:00:00.000Z",
          due_date: "2024-03-13 12:00:00.000Z",
          title: "Internet",
          amount_cents: 10000,
          status: "pendente",
          attempts: 0,
        },
      },
    );
    expect(delivery.status).toBe(200);

    const paid = await push(harness, family.token, family.householdId, [
      {
        ...operation(
          crypto.randomUUID(),
          "bills",
          "update",
          {
            id: billLocalId,
            household: "",
            sync_id: billSyncId,
            title: "Internet",
            amount_cents: 10000,
            type: "variavel",
            nature: "saida",
            due_date: "2024-03-13",
            periodicity: "unica",
            status: "pago",
            attribution: "ambos",
          },
          billId,
        ),
        client_ts: new Date(Date.now() + 60_000).toISOString(),
      },
    ]);
    expect(paid.data.results[0]?.status).toBe("applied");

    const check = await api<{ status: string }>(
      harness,
      `/api/collections/notification_deliveries/records/${delivery.data.id}`,
      { token: harness.adminToken },
    );
    expect(check.data.status).toBe("descartado");
  });

  it("keeps preferences isolated between households", async () => {
    const prefs = await api<{ push_enabled: boolean; preferences: { horario_envio: string } }>(
      harness,
      "/api/notifications/preferences",
      { token: other.token },
    );
    expect(prefs.data.push_enabled).toBe(false);
    expect(prefs.data.preferences.horario_envio).toBe("08:30");
  });

  it("creates a coverage request delivery for the partner", async () => {
    const partnerId = await createUser(harness, "parceiro-cobertura@example.com", "Parceiro");
    const member = await api(harness, "/api/collections/household_members/records", {
      token: harness.adminToken,
      body: {
        household: family.householdId,
        user: partnerId,
        role: "partner",
        invite_status: "accepted",
        permissions: {},
      },
    });
    expect(member.status).toBeLessThan(400);

    const invalid = await api(harness, "/api/notifications/coverage", {
      token: family.token,
      body: { amount_cents: 0 },
    });
    expect(invalid.status).toBe(400);

    const sent = await api<{ ok: boolean; sent_to: number }>(harness, "/api/notifications/coverage", {
      token: family.token,
      body: { amount_cents: 5000, note: "Segura o aluguel" },
    });
    expect(sent.status).toBe(202);
    expect(sent.data.sent_to).toBe(1);

    const deliveries = await api<{
      items: Array<{ kind: string; status: string; amount_cents: number; note?: string; title: string }>;
    }>(
      harness,
      `/api/collections/notification_deliveries/records?filter=${encodeURIComponent(
        `user="${partnerId}" && kind="cobertura"`,
      )}`,
      { token: harness.adminToken },
    );
    expect(deliveries.data.items).toHaveLength(1);
    expect(deliveries.data.items[0]?.status).toBe("pendente");
    expect(deliveries.data.items[0]?.amount_cents).toBe(5000);
    expect(deliveries.data.items[0]?.note).toBe("Segura o aluguel");
  });
});
