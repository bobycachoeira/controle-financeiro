import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "@/api/auth-api";
import { clearTokens, saveTokens } from "@/api/tokens";

interface Captured {
  url: string;
  init: RequestInit;
}

function mockFetch(body: unknown, status = 200): Captured[] {
  const captured: Captured[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string, init: RequestInit) => {
      captured.push({ url, init });
      return Promise.resolve(
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
  return captured;
}

describe("auth-api contract", () => {
  beforeEach(() => {
    saveTokens({ token: "jwt-token", refreshToken: "refresh-token", stepUpToken: "stepup-token" });
  });

  afterEach(() => {
    clearTokens();
    vi.unstubAllGlobals();
  });

  it("calls 2fa setup with the step-up header", async () => {
    const captured = mockFetch({ otpauth_uri: "otpauth://totp/x", secret: "ABC" });
    const result = await authApi.setup2fa();
    expect(result.secret).toBe("ABC");
    const call = captured[0]!;
    expect(call.url).toContain("/auth/2fa/setup");
    expect(call.init.method).toBe("POST");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["X-Step-Up-Token"]).toBe("stepup-token");
    expect(headers.Authorization).toBe("Bearer jwt-token");
  });

  it("lists trusted devices", async () => {
    const captured = mockFetch({ items: [{ id: "d1", label: "Phone" }] });
    const result = await authApi.listDevices();
    expect(result.items[0]?.id).toBe("d1");
    expect(captured[0]?.url).toContain("/auth/devices");
  });

  it("revokes a device with DELETE", async () => {
    const captured = mockFetch(undefined, 204);
    await authApi.revokeDevice("d1");
    expect(captured[0]?.url).toContain("/auth/devices/d1");
    expect(captured[0]?.init.method).toBe("DELETE");
  });

  it("confirms 2FA and returns recovery codes", async () => {
    mockFetch({ recovery_codes: ["AAAAA-BBBBB"] });
    const result = await authApi.confirm2fa("123456");
    expect(result.recovery_codes).toHaveLength(1);
  });
});
