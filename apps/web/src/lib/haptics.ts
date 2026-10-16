const STORAGE_KEY = "cf.haptics";

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHapticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // sem storage: segue desligado
  }
}

/** Vibração curta de confirmação (opt-in em Mais → Aparência). */
export function haptic(pattern: number | number[] = 10): void {
  if (!hapticsEnabled()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // alguns navegadores bloqueiam fora de gesto do usuário
  }
}
