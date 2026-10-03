import { errorEnvelopeSchema } from "@cf/shared";
import { clearTokens, loadTokens, saveTokens, type SessionTokens } from "./tokens";

export const API_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8090/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isStepUpRequired(): boolean {
    return this.code === "step_up_required" || this.status === 403;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
  stepUp?: boolean;
  signal?: AbortSignal;
  retry?: boolean;
}

let refreshInFlight: Promise<SessionTokens | null> | null = null;

async function refreshTokens(): Promise<SessionTokens | null> {
  const current = loadTokens();
  if (!current?.refreshToken) return null;
  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    return null;
  }
  const data = (await response.json()) as { token: string; refresh_token?: string };
  const tokens: SessionTokens = {
    token: data.token,
    refreshToken: data.refresh_token ?? current.refreshToken,
    stepUpToken: current.stepUpToken,
    stepUpExpiresAt: current.stepUpExpiresAt,
  };
  saveTokens(tokens);
  return tokens;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, stepUp = false, signal } = options;
  const tokens = auth ? loadTokens() : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (tokens?.token) headers.Authorization = `Bearer ${tokens.token}`;
  if (stepUp && tokens?.stepUpToken) headers["X-Step-Up-Token"] = tokens.stepUpToken;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 401 && auth && options.retry !== false) {
    refreshInFlight ??= refreshTokens();
    const refreshed = await refreshInFlight;
    refreshInFlight = null;
    if (refreshed) {
      return request<T>(path, { ...options, retry: false });
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text ? JSON.parse(text) : undefined;

  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(data);
    if (parsed.success) {
      throw new ApiError(
        response.status,
        parsed.data.error.code,
        parsed.data.error.message,
        parsed.data.error.details ?? [],
      );
    }
    throw new ApiError(response.status, "http_error", response.statusText || "Erro inesperado");
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  del: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
};
