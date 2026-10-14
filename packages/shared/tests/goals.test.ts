import { describe, expect, it } from "vitest";
import { goalProgress } from "../src/domain/goals";

describe("goalProgress", () => {
  it("soma aportes e calcula o restante", () => {
    const progress = goalProgress(100000, [
      { amount_cents: 30000 },
      { amount_cents: 20000 },
      { amount_cents: -5000 },
    ]);
    expect(progress.savedCents).toBe(45000);
    expect(progress.remainingCents).toBe(55000);
    expect(progress.percent).toBe(45);
    expect(progress.completed).toBe(false);
  });

  it("marca concluída e limita o percentual a 100", () => {
    const progress = goalProgress(10000, [{ amount_cents: 15000 }]);
    expect(progress.percent).toBe(100);
    expect(progress.remainingCents).toBe(0);
    expect(progress.completed).toBe(true);
  });

  it("não fica negativo com resgates maiores que os aportes", () => {
    const progress = goalProgress(10000, [{ amount_cents: -2000 }]);
    expect(progress.savedCents).toBe(-2000);
    expect(progress.percent).toBe(0);
  });
});
