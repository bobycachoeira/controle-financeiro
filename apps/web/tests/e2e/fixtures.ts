import { test as base, type Page } from "@playwright/test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const appDir = resolve(here, "../../../pocketbase");
const binary = join(appDir, "pocketbase");
const migrationsDir = join(appDir, "pb_migrations");
const hooksDir = join(appDir, "pb_hooks");

const PORT = 8091;
export const API_URL = `http://127.0.0.1:${PORT}/api`;

export const TITULAR_EMAIL = "paulo@familia.test";
export const TITULAR_NAME = "Paulo Souza";
export const MAE_EMAIL = "maria@familia.test";
export const MAE_NAME = "Maria Souza";
export const HOUSEHOLD_NAME = "Família Souza";

export interface Persona {
  email: string;
  name: string;
  token: string;
  /** Segredo TOTP quando o 2FA está ativo. */
  secret?: string;
}

interface ApiResult<T> {
  status: number;
  data: T;
}

export interface Backend {
  titular: Persona;
  mae: Persona;
  household: string;
  api: <T>(path: string, options?: ApiOptions) => Promise<ApiResult<T>>;
  magicTokenFor: (email: string) => string | null;
  login: (email: string) => Promise<string>;
  stepUpCode: (persona: Persona) => string;
  logs: () => string;
  stop: () => Promise<void>;
}

export interface ApiOptions {
  token?: string;
  stepUp?: string;
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function toBase32Bytes(secret: string): number[] {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return bytes;
}

export function totpCode(secret: string, offset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + offset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(toBase32Bytes(secret))).update(buffer).digest();
  const o = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const code =
    ((((hmac[o] ?? 0) & 0x7f) << 24) |
      ((hmac[o + 1] ?? 0) << 16) |
      ((hmac[o + 2] ?? 0) << 8) |
      (hmac[o + 3] ?? 0)) %
    1_000_000;
  return String(code).padStart(6, "0");
}

async function waitForHealth(timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${API_URL}/health`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("PocketBase não subiu a tempo");
}

async function startBackend(): Promise<Backend> {
  const dataDir = mkdtempSync(join(tmpdir(), "cf-e2e-"));
  const child: ChildProcessWithoutNullStreams = spawn(
    binary,
    [
      "serve",
      "--dev",
      `--http=127.0.0.1:${PORT}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${migrationsDir}`,
      `--hooksDir=${hooksDir}`,
    ],
    {
      cwd: appDir,
      env: {
        ...process.env,
        CF_SINGLE_HOUSEHOLD: "false",
        CF_ENCRYPTION_KEY: "e2e-insecure-key-change-me-1234567890",
        CF_ADMIN_EMAIL: TITULAR_EMAIL,
        CF_ADMIN_NAME: TITULAR_NAME,
        CF_STEPUP_TTL: "10m",
      },
    },
  );

  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk.toString()));
  child.stderr.on("data", (chunk) => (output += chunk.toString()));

  await waitForHealth();

  function magicTokenFor(email: string): string | null {
    const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`MAGIC_LINK ${escaped} -> ([^\\s]+)`, "g");
    const matches = [...output.matchAll(regex)];
    const last = matches[matches.length - 1];
    const raw = last?.[1];
    if (!raw) return null;
    return new URL(raw).searchParams.get("token");
  }

  async function api<T>(path: string, options: ApiOptions = {}): Promise<ApiResult<T>> {
    const method = options.method ?? (options.body === undefined ? "GET" : "POST");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.stepUp) headers["X-Step-Up-Token"] = options.stepUp;
    Object.assign(headers, options.headers ?? {});
    const response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as T) : (undefined as T);
    return { status: response.status, data };
  }

  async function login(email: string): Promise<string> {
    await api("/auth/magic-link/request", { body: { email } });
    let token: string | null = null;
    for (let i = 0; i < 40 && !token; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
      token = magicTokenFor(email);
    }
    if (!token) throw new Error(`magic token não encontrado para ${email}`);
    const result = await api<{ token: string }>("/auth/magic-link/verify", {
      body: { token, device_label: "e2e" },
    });
    if (result.status >= 400) throw new Error(`login falhou: ${JSON.stringify(result.data)}`);
    return result.data.token;
  }

  // --- seed: família + duas personas ---
  const titularToken = await login(TITULAR_EMAIL);
  const created = await api<{ household: { id: string } }>("/households", {
    token: titularToken,
    body: { name: HOUSEHOLD_NAME },
  });
  if (created.status >= 400) throw new Error(`criar família falhou: ${JSON.stringify(created.data)}`);
  const household = created.data.household.id;

  // 2FA do titular (para ações sensíveis / step-up)
  const setup = await api<{ secret: string }>("/auth/2fa/setup", { token: titularToken, body: {} });
  const secret = setup.data.secret;
  await api("/auth/2fa/confirm", { token: titularToken, body: { code: totpCode(secret) } });

  // cria a mãe e a coloca como membro (partner), via fluxo de convite + aprovação
  const verify = await api<{ step_up_token: string }>("/auth/2fa/verify", {
    body: { session_token: titularToken, code: totpCode(secret), kind: "totp" },
  });
  const invite = await api<{ invite: { token: string } }>(`/households/${household}/invites`, {
    token: titularToken,
    stepUp: verify.data.step_up_token,
    body: { email_invited: MAE_EMAIL, role: "partner" },
  });
  if (invite.status >= 400) throw new Error(`convidar falhou: ${JSON.stringify(invite.data)}`);

  const maeToken = await login(MAE_EMAIL);
  await api("/auth/me", { token: maeToken, method: "PATCH", body: { name: MAE_NAME } });
  const accepted = await api<{ member: { id: string } }>(
    `/invites/${invite.data.invite.token}/accept`,
    { token: maeToken, body: {} },
  );
  if (accepted.status >= 400) throw new Error(`aceitar falhou: ${JSON.stringify(accepted.data)}`);

  const stepUp2 = await api<{ step_up_token: string }>("/auth/2fa/verify", {
    body: { session_token: titularToken, code: totpCode(secret), kind: "totp" },
  });
  const approve = await api(`/households/${household}/join-requests/${accepted.data.member.id}/approve`, {
    token: titularToken,
    stepUp: stepUp2.data.step_up_token,
    body: { role: "partner" },
  });
  if (approve.status >= 400) throw new Error(`aprovar falhou: ${JSON.stringify(approve.data)}`);

  const titular: Persona = { email: TITULAR_EMAIL, name: TITULAR_NAME, token: titularToken, secret };
  const mae: Persona = { email: MAE_EMAIL, name: MAE_NAME, token: maeToken };

  // Conta padrão da família (para as personas lançarem sem precisar criar).
  await seedAccount(titularToken, household, "Conta Principal");
  await seedAccount(titularToken, household, "Poupança");

  return {
    titular,
    mae,
    household,
    api,
    magicTokenFor,
    login,
    stepUpCode: (persona) => {
      if (!persona.secret) throw new Error("persona sem 2FA");
      return totpCode(persona.secret);
    },
    logs: () => output,
    stop: () =>
      new Promise<void>((resolvePromise) => {
        child.once("exit", () => {
          try {
            rmSync(dataDir, { recursive: true, force: true });
          } catch {
            // ignore
          }
          resolvePromise();
        });
        child.kill("SIGTERM");
        setTimeout(() => {
          if (!child.killed) child.kill("SIGKILL");
        }, 4000);
      }),
  };
}

function randomLocalId(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 15 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

async function seedAccount(token: string, household: string, name: string): Promise<void> {
  const id = randomLocalId();
  const syncId = crypto.randomUUID();
  const operations = [
    {
      sync_id: crypto.randomUUID(),
      entity: "accounts",
      operation: "create",
      entity_id: id,
      payload: {
        id,
        household,
        sync_id: syncId,
        updated_by: null,
        deleted_at: null,
        name,
        type: "corrente",
        currency: "BRL",
        initial_balance_cents: 0,
        include_in_total: true,
        active: true,
        order: 0,
        color: null,
        icon: null,
        owner: "indefinido",
      },
      client_ts: new Date().toISOString(),
    },
  ];
  const result = await fetch(`${API_URL}/sync/push`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ household, operations }),
  });
  const json = (await result.json()) as { results?: Array<{ status: string; message?: string }> };
  const first = json.results?.[0];
  if (!result.ok || first?.status !== "applied") {
    throw new Error(`seed de conta falhou: ${JSON.stringify(json)}`);
  }
}

export type LoginAs = (persona: "titular" | "mae") => Promise<void>;

interface TestFixtures {
  loginAs: LoginAs;
}

interface WorkerFixtures {
  backend: Backend;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  backend: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const backend = await startBackend();
      await use(backend);
      await backend.stop();
    },
    { scope: "worker" },
  ],

  loginAs: async ({ page, backend }, use) => {
    page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));
    page.on("console", (msg) => {
      if (msg.type() === "error") console.log(`[console.error] ${msg.text()}`);
    });
    const run: LoginAs = async (persona) => {
      const user = backend[persona];
      await page.addInitScript((tokens) => {
        localStorage.setItem("cf.session", JSON.stringify(tokens));
      }, { token: user.token, refreshToken: user.token });
    };
    await use(run);
  },
});

export { expect } from "@playwright/test";
export type { Page };
