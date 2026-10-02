import { describe, expect, it } from "vitest";
import { pushRequestSchema, pullResponseSchema, pushResponseSchema } from "@cf/shared";

describe("sync schemas", () => {
  it("accepts a valid push request", () => {
    const parsed = pushRequestSchema.safeParse({
      household: "h1",
      operations: [
        {
          sync_id: "00000000-0000-4000-8000-000000000001",
          entity: "transactions",
          operation: "create",
          payload: { amount_cents: 1000 },
          client_ts: "2024-03-01T10:00:00.000Z",
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown entity name", () => {
    const parsed = pushRequestSchema.safeParse({
      household: "h1",
      operations: [
        {
          sync_id: "00000000-0000-4000-8000-000000000001",
          entity: "unknown",
          operation: "create",
          client_ts: "2024-03-01T10:00:00.000Z",
        },
      ],
    });
    expect(parsed.success).toBe(false);
  });

  it("validates a push response with conflicts", () => {
    const parsed = pushResponseSchema.safeParse({
      results: [
        {
          sync_id: "00000000-0000-4000-8000-000000000001",
          entity: "transactions",
          status: "conflict",
          conflict: true,
          code: "conflict_kept_server",
        },
      ],
      server_seq: 12,
    });
    expect(parsed.success).toBe(true);
  });

  it("validates a pull response with soft deletes", () => {
    const parsed = pullResponseSchema.safeParse({
      server_seq: 5,
      has_more: false,
      changes: [{ entity: "accounts", id: "a1", seq: 5, deleted: true }],
    });
    expect(parsed.success).toBe(true);
  });
});
