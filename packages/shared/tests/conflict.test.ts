import { describe, expect, it } from "vitest";
import { resolveConflict } from "../src/domain/conflict";

describe("LWW conflict resolver", () => {
  it("keeps the newest client update", () => {
    const decision = resolveConflict({
      clientUpdatedAt: "2024-01-02T10:00:00.000Z",
      serverUpdatedAt: "2024-01-01T10:00:00.000Z",
    });
    expect(decision.winner).toBe("client");
    expect(decision.conflict).toBe(false);
  });

  it("server wins when newer", () => {
    const decision = resolveConflict({
      clientUpdatedAt: "2024-01-01T10:00:00.000Z",
      serverUpdatedAt: "2024-01-02T10:00:00.000Z",
    });
    expect(decision.winner).toBe("server");
    expect(decision.conflict).toBe(true);
  });

  it("server wins on tie without flagging conflict", () => {
    const ts = "2024-01-01T10:00:00.000Z";
    const decision = resolveConflict({ clientUpdatedAt: ts, serverUpdatedAt: ts });
    expect(decision.winner).toBe("server");
    expect(decision.conflict).toBe(false);
  });

  it("tombstone prevails over client update", () => {
    const decision = resolveConflict({
      clientUpdatedAt: "2024-05-01T10:00:00.000Z",
      serverUpdatedAt: "2024-01-01T10:00:00.000Z",
      serverDeleted: true,
    });
    expect(decision.winner).toBe("server");
    expect(decision.conflict).toBe(true);
    expect(decision.reason).toBe("tombstone_prevails");
  });

  it("handles invalid timestamps by keeping server", () => {
    const decision = resolveConflict({
      clientUpdatedAt: "not-a-date",
      serverUpdatedAt: "2024-01-01T10:00:00.000Z",
    });
    expect(decision.winner).toBe("server");
  });
});
