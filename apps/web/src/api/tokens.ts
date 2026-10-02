export interface SessionTokens {
  token: string;
  refreshToken: string;
  stepUpToken?: string;
  stepUpExpiresAt?: number;
}

const STORAGE_KEY = "cf.session";

export function loadTokens(): SessionTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionTokens;
  } catch {
    return null;
  }
}

export function saveTokens(tokens: SessionTokens): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY);
}
