import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const appDir = resolve(here, "..");
const binary = join(appDir, "pocketbase");
const migrationsDir = join(appDir, "pb_migrations");
const hooksDir = join(appDir, "pb_hooks");

export interface Harness {
  baseUrl: string;
  adminToken: string;
  dataDir: string;
  logs: () => string;
  magicTokenFor: (email: string) => string | null;
  stop: () => Promise<void>;
}

async function waitForHealth(baseUrl: string, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("PocketBase did not become healthy in time");
}

export async function startHarness(options: { env?: Record<string, string> } = {}): Promise<Harness> {
  const dataDir = mkdtempSync(join(tmpdir(), "cf-pb-"));
  const port = 18200 + Math.floor(Math.random() * 500);
  const baseUrl = `http://127.0.0.1:${port}`;

  spawnSync(binary, ["superuser", "upsert", "admin@test.com", "secret12345", `--dir=${dataDir}`], {
    cwd: appDir,
    encoding: "utf8",
  });

  const child: ChildProcessWithoutNullStreams = spawn(
    binary,
    [
      "serve",
      "--dev",
      `--http=127.0.0.1:${port}`,
      `--dir=${dataDir}`,
      `--migrationsDir=${migrationsDir}`,
      `--hooksDir=${hooksDir}`,
    ],
    { cwd: appDir, env: { ...process.env, CF_SINGLE_HOUSEHOLD: "false", ...(options.env ?? {}) } },
  );

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitForHealth(baseUrl);

  const authResponse = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: "admin@test.com", password: "secret12345" }),
  });
  const authJson = (await authResponse.json()) as { token: string };

  return {
    baseUrl,
    adminToken: authJson.token,
    dataDir,
    logs: () => output,
    magicTokenFor: (email: string) => {
      const regex = new RegExp(
        `MAGIC_LINK ${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} -> ([^\\s]+)`,
        "g",
      );
      const matches = [...output.matchAll(regex)];
      const last = matches[matches.length - 1];
      if (!last) return null;
      const url = new URL(last[1]);
      return url.searchParams.get("token");
    },
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

export interface ApiOptions {
  token?: string;
  body?: unknown;
  method?: string;
  headers?: Record<string, string>;
}

export async function api<T>(harness: Harness, path: string, options: ApiOptions = {}): Promise<{ status: number; data: T }> {
  const method = options.method ?? (options.body === undefined ? "GET" : "POST");
  const response = await fetch(`${harness.baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : (undefined as T);
  return { status: response.status, data };
}

export async function createUser(
  harness: Harness,
  email: string,
  name: string,
): Promise<string> {
  const result = await api<{ id: string }>(harness, "/api/collections/users/records", {
    token: harness.adminToken,
    body: { email, name, password: "secret12345", passwordConfirm: "secret12345", active: true },
  });
  if (result.status >= 400) throw new Error(`createUser failed: ${JSON.stringify(result.data)}`);
  return result.data.id;
}

export interface Family {
  token: string;
  householdId: string;
  userId: string;
}

export async function setupFamily(harness: Harness, email: string, name: string): Promise<Family> {
  const userId = await createUser(harness, email, name);
  const { token } = await loginWithMagicLink(harness, email);
  const created = await api<{ household: { id: string } }>(harness, "/api/households", {
    token,
    body: { name: `${name} family` },
  });
  if (created.status >= 400) throw new Error(`household create failed: ${JSON.stringify(created.data)}`);
  return { token, householdId: created.data.household.id, userId };
}

export async function enableTwoFactor(
  harness: Harness,
  token: string,
): Promise<{ secret: string; stepUpToken: string }> {
  const setup = await api<{ secret: string }>(harness, "/api/auth/2fa/setup", {
    token,
    method: "POST",
    body: {},
  });
  const secret = setup.data.secret;
  const confirm = await api(harness, "/api/auth/2fa/confirm", {
    token,
    body: { code: totpCode(secret) },
  });
  if (confirm.status >= 400) throw new Error("2fa confirm failed");
  const verify = await api<{ step_up_token: string }>(harness, "/api/auth/2fa/verify", {
    body: { session_token: token, code: totpCode(secret), kind: "totp" },
  });
  return { secret, stepUpToken: verify.data.step_up_token };
}

export function totpCode(secret: string, offset = 0): string {
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
  const counter = Math.floor(Date.now() / 1000 / 30) + offset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", Buffer.from(bytes)).update(buffer).digest();
  const o = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[o] & 0x7f) << 24) | (hmac[o + 1] << 16) | (hmac[o + 2] << 8) | hmac[o + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

export function operation(
  syncId: string,
  entity: string,
  op: "create" | "update" | "delete",
  payload: Record<string, unknown>,
  entityId?: string | null,
) {
  return {
    sync_id: syncId,
    entity,
    operation: op,
    entity_id: entityId ?? null,
    payload,
    client_ts: new Date().toISOString(),
  };
}

export async function push(
  harness: Harness,
  token: string,
  household: string,
  operations: unknown[],
): Promise<{ status: number; data: { results: Array<Record<string, unknown>>; server_seq: number } }> {
  return api(harness, "/api/sync/push", { token, body: { household, operations } });
}

export async function loginWithMagicLink(
  harness: Harness,
  email: string,
): Promise<{ token: string; stepUpRequired: boolean }> {
  await api(harness, "/api/auth/magic-link/request", { body: { email } });
  await new Promise((r) => setTimeout(r, 300));
  const magicToken = harness.magicTokenFor(email);
  if (!magicToken) throw new Error(`magic token not found for ${email}`);
  const result = await api<{ token: string; step_up_required: boolean }>(
    harness,
    "/api/auth/magic-link/verify",
    { body: { token: magicToken, device_label: "test" } },
  );
  if (result.status >= 400) throw new Error(`verify failed: ${JSON.stringify(result.data)}`);
  return { token: result.data.token, stepUpRequired: result.data.step_up_required };
}
