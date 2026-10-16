import { beforeEach, describe, expect, it } from "vitest";
import { readUxMetrics, resetUxMetrics, trackUx } from "@/lib/ux-metrics";

describe("métricas locais de UX", () => {
  beforeEach(() => {
    resetUxMetrics();
  });

  it("acumula contadores por evento", () => {
    trackUx("quick_add_opened");
    trackUx("quick_add_opened");
    trackUx("quick_add_saved", 4200);
    trackUx("quick_add_abandoned");
    const metrics = readUxMetrics();
    expect(metrics.quick_add_opened).toBe(2);
    expect(metrics.quick_add_saved).toBe(1);
    expect(metrics.quick_add_abandoned).toBe(1);
    expect(metrics.quick_add_total_ms).toBe(4200);
  });

  it("ignora tempo inválido e JSON corrompido", () => {
    trackUx("quick_add_saved", -5);
    expect(readUxMetrics().quick_add_total_ms).toBe(0);
    localStorage.setItem("cf.ux_metrics", "{não é json");
    expect(readUxMetrics()).toEqual({
      quick_add_opened: 0,
      quick_add_saved: 0,
      quick_add_abandoned: 0,
      quick_add_total_ms: 0,
      form_opened: 0,
      form_saved: 0,
    });
  });
});
