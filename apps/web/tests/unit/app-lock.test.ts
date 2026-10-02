import { beforeEach, describe, expect, it } from "vitest";
import { useAppLock } from "@/composables/useAppLock";

describe("app lock", () => {
  beforeEach(() => {
    localStorage.clear();
    delete (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
  });

  it("reports biometrics as unsupported without PublicKeyCredential", () => {
    const appLock = useAppLock();
    expect(appLock.supported.value).toBe(false);
  });

  it("does not block the user when biometrics are unavailable", async () => {
    const appLock = useAppLock();
    const ok = await appLock.enable(60_000);
    expect(ok).toBe(false);
    expect(appLock.enabled.value).toBe(true);
    appLock.disable();
    expect(appLock.enabled.value).toBe(false);
  });

  it("unlocks immediately when unsupported", async () => {
    const appLock = useAppLock();
    await expect(appLock.unlock()).resolves.toBe(true);
  });
});
