import { describe, expect, it } from "vitest";
import { conflictDiff, type ConflictEntry } from "@/sync/conflict";

function entry(client: Record<string, unknown>, server: Record<string, unknown>): ConflictEntry {
  return {
    entity: "bills",
    id: "bill1",
    reason: "conflict_kept_server",
    serverRecord: { id: "bill1", ...server } as never,
    clientPayload: { id: "bill1", ...client },
  };
}

describe("conflictDiff", () => {
  it("lista apenas os campos que diferem e ignora metadados", () => {
    const diffs = conflictDiff(
      entry(
        { title: "Água", amount_cents: 30000, status: "pendente", household: "h1", updated: "2026-01-01T00:00:00.000Z" },
        { title: "Água", amount_cents: 32000, status: "a_confirmar", household: "h1", updated: "2026-01-02T00:00:00.000Z" },
      ),
    );
    const fields = diffs.map((diff) => diff.field).sort();
    expect(fields).toEqual(["amount_cents", "status"]);
    expect(diffs.find((diff) => diff.field === "amount_cents")).toMatchObject({
      client: 30000,
      server: 32000,
    });
  });

  it("não considera diferença quando só o formato da data muda", () => {
    const diffs = conflictDiff(
      entry({ due_date: "2026-03-10" }, { due_date: "2026-03-10 00:00:00.000Z" }),
    );
    expect(diffs).toHaveLength(0);
  });

  it("ignora campos internos (_dirty/_review)", () => {
    const diffs = conflictDiff(entry({ _dirty: true }, { _dirty: false }));
    expect(diffs).toHaveLength(0);
  });
});
