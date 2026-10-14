import { describe, expect, it } from "vitest";
import { formatDateShort } from "@/lib/format";

describe("formatDateShort", () => {
  const now = new Date("2026-06-15T12:00:00Z");

  it("mostra dd/mm no ano corrente", () => {
    expect(formatDateShort("2026-10-17", now)).toBe("17/10");
  });

  it("mostra dd/mm/aaaa em outro ano", () => {
    expect(formatDateShort("2025-10-17", now)).toBe("17/10/2025");
  });
});
