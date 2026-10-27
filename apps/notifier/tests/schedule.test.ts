import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFERENCES, notificationPreferencesSchema } from "@cf/shared";
import { buildReminderJobs, type BuildInput } from "../src/schedule";

function prefs(overrides: Record<string, unknown> = {}) {
  return notificationPreferencesSchema.parse(overrides);
}

function baseInput(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    today: "2024-03-10",
    nowTime: "09:00",
    preferences: [
      {
        userId: "u1",
        household: "h1",
        pushEnabled: true,
        preferences: prefs({ contas_a_pagar: { habilitado: true, dias_antes: [3] } }),
        subscriptions: 1,
      },
    ],
    bills: [
      {
        id: "b1",
        household: "h1",
        title: "Internet",
        amountCents: 10000,
        dueDate: "2024-03-13",
        nature: "saida",
        type: "variavel",
        periodicity: "unica",
        status: "pendente",
      },
    ],
    invoices: [],
    existing: [],
    ...overrides,
  };
}

describe("reminder scheduling", () => {
  it("creates a job for a bill due in N days", () => {
    const jobs = buildReminderJobs(baseInput());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.kind).toBe("contas_a_pagar");
    expect(jobs[0]?.entityId).toBe("b1");
  });

  it("skips disabled reminder types", () => {
    const jobs = buildReminderJobs(
      baseInput({
        preferences: [
          {
            userId: "u1",
            household: "h1",
            pushEnabled: true,
            preferences: prefs({ contas_a_pagar: { habilitado: false, dias_antes: [3] } }),
            subscriptions: 1,
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(0);
  });

  it("waits until the preferred time", () => {
    const jobs = buildReminderJobs(baseInput({ nowTime: "07:00" }));
    expect(jobs).toHaveLength(0);
  });

  it("defers during quiet hours", () => {
    const jobs = buildReminderJobs(
      baseInput({
        nowTime: "23:30",
        preferences: [
          {
            userId: "u1",
            household: "h1",
            pushEnabled: true,
            preferences: prefs({
              horario_envio: "23:00",
              quiet_hours: { ativar: true, inicio: "22:00", fim: "07:00" },
              contas_a_pagar: { habilitado: true, dias_antes: [3] },
            }),
            subscriptions: 1,
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(0);
  });

  it("ignores paid bills and duplicate deliveries", () => {
    const paid = buildReminderJobs(
      baseInput({ bills: [{ ...baseInput().bills[0]!, status: "pago" }] }),
    );
    expect(paid).toHaveLength(0);

    const duplicated = buildReminderJobs(
      baseInput({
        existing: [
          {
            user: "u1",
            kind: "contas_a_pagar",
            entity: "bills",
            entityId: "b1",
            scheduledDate: "2024-03-10",
          },
        ],
      }),
    );
    expect(duplicated).toHaveLength(0);
  });

  it("classifies recurring bills and prioritizes invoices", () => {
    const jobs = buildReminderJobs(
      baseInput({
        preferences: [
          {
            userId: "u1",
            household: "h1",
            pushEnabled: true,
            preferences: prefs({
              contas_a_pagar: { habilitado: true, dias_antes: [3] },
              fixas_recorrentes: { habilitado: true, dias_antes: [3] },
              fatura_cartao: { habilitado: true, dias_antes: [3] },
            }),
            subscriptions: 1,
          },
        ],
        bills: [
          { ...baseInput().bills[0]!, periodicity: "mensal" },
          baseInput().bills[0]!,
        ],
        invoices: [
          {
            id: "i1",
            household: "h1",
            title: "Fatura 2024-03",
            dueDate: "2024-03-13",
            totalCents: 50000,
            status: "fechada",
          },
        ],
      }),
    );
    expect(jobs[0]?.kind).toBe("fatura_cartao");
    expect(jobs.some((job) => job.kind === "fixas_recorrentes")).toBe(true);
  });

  it("does not remind an invoice before its closing date", () => {
    const jobs = buildReminderJobs(
      baseInput({
        preferences: [
          {
            userId: "u1",
            household: "h1",
            pushEnabled: true,
            preferences: prefs({ fatura_cartao: { habilitado: true, dias_antes: [3] } }),
            subscriptions: 1,
          },
        ],
        bills: [],
        invoices: [
          {
            id: "i1",
            household: "h1",
            title: "Fatura 2024-03",
            dueDate: "2024-03-13",
            closingDate: "2024-03-12",
            totalCents: 50000,
            status: "aberta",
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(0);
  });

  it("reminds an invoice once its closing date has passed", () => {
    const jobs = buildReminderJobs(
      baseInput({
        preferences: [
          {
            userId: "u1",
            household: "h1",
            pushEnabled: true,
            preferences: prefs({ fatura_cartao: { habilitado: true, dias_antes: [3, 1] } }),
            subscriptions: 1,
          },
        ],
        bills: [],
        invoices: [
          {
            id: "i1",
            household: "h1",
            title: "Fatura 2024-03",
            dueDate: "2024-03-13",
            closingDate: "2024-03-10",
            totalCents: 50000,
            status: "aberta",
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.kind).toBe("fatura_cartao");
  });

  it("reminds to confirm the value of an emitted variable bill", () => {
    const jobs = buildReminderJobs(
      baseInput({
        bills: [
          {
            ...baseInput().bills[0]!,
            status: "a_confirmar",
            type: "variavel",
            emissionDate: "2024-03-10",
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.title).toContain("Confirme o valor");
  });

  it("does not remind before the emission date", () => {
    const jobs = buildReminderJobs(
      baseInput({
        bills: [
          {
            ...baseInput().bills[0]!,
            status: "a_confirmar",
            emissionDate: "2024-03-20",
          },
        ],
      }),
    );
    expect(jobs).toHaveLength(0);
  });

  it("does not notify households without subscription", () => {
    const jobs = buildReminderJobs(
      baseInput({
        preferences: [
          { userId: "u1", household: "h1", pushEnabled: false, preferences: DEFAULT_NOTIFICATION_PREFERENCES, subscriptions: 0 },
        ],
      }),
    );
    expect(jobs).toHaveLength(0);
  });
});
