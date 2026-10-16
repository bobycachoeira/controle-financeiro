export interface UxMetrics {
  quick_add_opened: number;
  quick_add_saved: number;
  quick_add_abandoned: number;
  quick_add_total_ms: number;
  form_opened: number;
  form_saved: number;
}

const STORAGE_KEY = "cf.ux_metrics";

const EMPTY: UxMetrics = {
  quick_add_opened: 0,
  quick_add_saved: 0,
  quick_add_abandoned: 0,
  quick_add_total_ms: 0,
  form_opened: 0,
  form_saved: 0,
};

/**
 * Contadores de UX guardados só no aparelho (localStorage), para medir
 * abandono/tempo do lançamento sem telemetria externa. Saem no backup JSON.
 */
export function readUxMetrics(): UxMetrics {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<UxMetrics>) };
  } catch {
    return { ...EMPTY };
  }
}

export function trackUx(
  event: Exclude<keyof UxMetrics, "quick_add_total_ms">,
  elapsedMs?: number,
): void {
  try {
    const current = readUxMetrics();
    current[event] += 1;
    if (event === "quick_add_saved" && elapsedMs && elapsedMs > 0) {
      current.quick_add_total_ms += elapsedMs;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // métricas locais: falha silenciosa, nunca atrapalha o lançamento
  }
}

export function resetUxMetrics(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
