import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api, createUser, loginWithMagicLink, startHarness, type Harness } from "./harness";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function totp(secret: string, offset = 0): string {
  const counter = Math.floor(Date.now() / 1000 / 30) + offset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", base32Decode(secret)).update(buffer).digest();
  const o = hmac[hmac.length - 1] & 0x0f;
  const code =
    (((hmac[o] & 0x7f) << 24) | (hmac[o + 1] << 16) | (hmac[o + 2] << 8) | hmac[o + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

describe("auth integration", () => {
  let harness: Harness;
  const email = "alice@example.com";

  beforeAll(async () => {
    harness = await startHarness();
    await createUser(harness, email, "Alice");
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("authenticates via magic link and rejects reuse", async () => {
    await api(harness, "/api/auth/magic-link/request", { body: { email } });
    await new Promise((r) => setTimeout(r, 300));
    const token = harness.magicTokenFor(email);
    expect(token).toBeTruthy();

    const verify = await api<{ token: string; step_up_required: boolean }>(
      harness,
      "/api/auth/magic-link/verify",
      { body: { token, device_label: "vitest" } },
    );
    expect(verify.status).toBe(200);
    expect(verify.data.token).toBeTruthy();

    const reuse = await api(harness, "/api/auth/magic-link/verify", {
      body: { token, device_label: "vitest" },
    });
    expect(reuse.status).toBe(410);
  });

  it("returns the current user from /auth/me", async () => {
    const { token } = await loginWithMagicLink(harness, email);
    const me = await api<{ user: { email: string }; memberships: unknown[] }>(
      harness,
      "/api/auth/me",
      { token },
    );
    expect(me.status).toBe(200);
    expect(me.data.user.email).toBe(email);
  });

  it("supports TOTP setup, confirm and verify, gating sensitive actions", async () => {
    const { token } = await loginWithMagicLink(harness, email);

    const setup = await api<{ secret: string; otpauth_uri: string }>(
      harness,
      "/api/auth/2fa/setup",
      { token, method: "POST", body: {} },
    );
    expect(setup.status).toBe(200);
    expect(setup.data.otpauth_uri).toContain("otpauth://totp/");

    const confirm = await api<{ recovery_codes: string[] }>(harness, "/api/auth/2fa/confirm", {
      token,
      body: { code: totp(setup.data.secret) },
    });
    expect(confirm.status).toBe(200);
    expect(confirm.data.recovery_codes).toHaveLength(10);

    const verify = await api<{ token: string; step_up_token: string; step_up_required: boolean }>(
      harness,
      "/api/auth/2fa/verify",
      { body: { session_token: token, code: totp(setup.data.secret), kind: "totp" } },
    );
    expect(verify.status).toBe(200);
    expect(verify.data.step_up_token).toBeTruthy();

    const badCode = await api(harness, "/api/auth/2fa/verify", {
      body: { session_token: token, code: "000000", kind: "totp" },
    });
    expect(badCode.status).toBe(401);

    const disableWithoutStepUp = await api(harness, "/api/auth/2fa/disable", {
      token,
      body: { code: totp(setup.data.secret) },
    });
    expect(disableWithoutStepUp.status).toBe(403);
  }, 30_000);

  it("locks the account after repeated 2FA failures", async () => {
    const lockedEmail = "lockme@example.com";
    await createUser(harness, lockedEmail, "Lock");
    const { token } = await loginWithMagicLink(harness, lockedEmail);
    const setup = await api<{ secret: string }>(harness, "/api/auth/2fa/setup", {
      token,
      method: "POST",
      body: {},
    });
    await api(harness, "/api/auth/2fa/confirm", {
      token,
      body: { code: totp(setup.data.secret) },
    });

    let lastStatus = 0;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const result = await api(harness, "/api/auth/2fa/verify", {
        body: { session_token: token, code: "000000", kind: "totp" },
      });
      lastStatus = result.status;
    }
    expect(lastStatus).toBe(429);
  }, 30_000);
});
