import { describe, expect, it, vi } from "vitest";
import { sendReminder, type DeliveryStore, type PushSender } from "../src/sender";
import type { ReminderJob } from "../src/schedule";

const job: ReminderJob = {
  user: "u1",
  household: "h1",
  kind: "contas_a_pagar",
  entity: "bills",
  entityId: "b1",
  dueDate: "2024-03-13",
  title: "Internet",
  amountCents: 10000,
  scheduledDate: "2024-03-10",
};

function memoryStore(alreadyClaimed = false): DeliveryStore & { sent: string[]; failed: string[] } {
  const state = {
    sent: [] as string[],
    failed: [] as string[],
    claim: vi.fn(async () => (alreadyClaimed ? null : "d1")),
    markSent: vi.fn(async (id: string) => {
      state.sent.push(id);
    }),
    markFailed: vi.fn(async (id: string) => {
      state.failed.push(id);
    }),
  };
  return state;
}

describe("sender", () => {
  it("sends to all target devices and marks sent", async () => {
    const store = memoryStore();
    const push: PushSender = { sendNotification: vi.fn(async () => ({})) };
    const result = await sendReminder(
      job,
      [
        { endpoint: "e1", p256dh: "k1", auth: "a1" },
        { endpoint: "e2", p256dh: "k2", auth: "a2" },
      ],
      push,
      store,
    );
    expect(result.sent).toBe(2);
    expect(store.sent).toEqual(["d1"]);
  });

  it("skips when the delivery already exists (dedup)", async () => {
    const store = memoryStore(true);
    const push: PushSender = { sendNotification: vi.fn(async () => ({})) };
    const result = await sendReminder(job, [{ endpoint: "e1", p256dh: "k1", auth: "a1" }], push, store);
    expect(result.skipped).toBe(true);
    expect(push.sendNotification).not.toHaveBeenCalled();
  });

  it("marks failed when all targets fail", async () => {
    const store = memoryStore();
    const push: PushSender = {
      sendNotification: vi.fn(async () => {
        throw new Error("gone");
      }),
    };
    const result = await sendReminder(job, [{ endpoint: "e1", p256dh: "k1", auth: "a1" }], push, store);
    expect(result.failed).toBe(1);
    expect(store.failed.length).toBeGreaterThan(0);
  });

  it("includes amount and due date in the payload", async () => {
    const store = memoryStore();
    let captured = "";
    const push: PushSender = {
      sendNotification: vi.fn(async (_target, payload: string) => {
        captured = payload;
        return {};
      }),
    };
    await sendReminder(job, [{ endpoint: "e1", p256dh: "k1", auth: "a1" }], push, store);
    expect(captured).toContain("R$");
    expect(captured).toContain("2024-03-13");
  });
});
