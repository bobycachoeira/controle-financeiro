import { describe, expect, it } from "vitest";
import { describeSyncError } from "@/sync/errors";

describe("sync error messages", () => {
  it("maps technical errors to friendly messages", () => {
    expect(describeSyncError("Failed to fetch")).toContain("Sem conexão");
    expect(describeSyncError("GoError: rate_limited")).toContain("Muitas sincronizações");
    expect(describeSyncError("validation_error")).toContain("dados inválidos");
    expect(describeSyncError("forbidden")).toContain("permissão");
    expect(describeSyncError("401 unauthorized")).toContain("Sessão expirada");
    expect(describeSyncError(null)).toBe("Erro desconhecido");
    expect(describeSyncError("algo raro")).toBe("algo raro");
  });
});
