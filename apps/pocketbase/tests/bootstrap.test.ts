import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createUser,
  loginWithMagicLink,
  setupFamily,
  startHarness,
  type Harness,
} from "./harness";

describe("app bootstrap and single-family lock", () => {
  let harness: Harness;

  beforeAll(async () => {
    harness = await startHarness({
      env: {
        CF_SINGLE_HOUSEHOLD: "true",
        CF_ADMIN_EMAIL: "bootstrap@example.com",
        CF_ADMIN_NAME: "Bootstrap",
      },
    });
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("creates the initial admin user from CF_ADMIN_EMAIL", async () => {
    const login = await loginWithMagicLink(harness, "bootstrap@example.com");
    expect(login.token).toBeTruthy();
  });

  it("blocks a second family while single-household is on", async () => {
    await setupFamily(harness, "first@example.com", "First");

    await createUser(harness, "second@example.com", "Second");
    const second = await loginWithMagicLink(harness, "second@example.com");
    const blocked = await api<{ error: { code: string } }>(harness, "/api/households", {
      token: second.token,
      body: { name: "Second family" },
    });
    expect(blocked.status).toBe(409);
    expect(blocked.data.error.code).toBe("single_household");
  });
});
