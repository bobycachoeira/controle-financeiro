import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  api,
  createUser,
  enableTwoFactor,
  loginWithMagicLink,
  setupFamily,
  startHarness,
  type Family,
  type Harness,
} from "./harness";

describe("RBAC and member limits", () => {
  let harness: Harness;
  let owner: Family;
  let stepUpToken: string;

  beforeAll(async () => {
    harness = await startHarness();
    owner = await setupFamily(harness, "owner@example.com", "Owner");
    const twofa = await enableTwoFactor(harness, owner.token);
    stepUpToken = twofa.stepUpToken;
  }, 60_000);

  afterAll(async () => {
    await harness?.stop();
  });

  it("requires step-up to create an invite", async () => {
    const withoutStepUp = await api(harness, `/api/households/${owner.householdId}/invites`, {
      token: owner.token,
      body: { email_invited: "partner@example.com", role: "partner" },
    });
    expect(withoutStepUp.status).toBe(403);

    const withStepUp = await api<{ invite: { token: string } }>(
      harness,
      `/api/households/${owner.householdId}/invites`,
      {
        token: owner.token,
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { email_invited: "partner@example.com", role: "partner" },
      },
    );
    expect(withStepUp.status).toBe(201);
    expect(withStepUp.data.invite.token).toBeTruthy();
  });

  it("accepts an invite and enforces the two-adult limit", async () => {
    const invite = await api<{ invite: { token: string } }>(
      harness,
      `/api/households/${owner.householdId}/invites`,
      {
        token: owner.token,
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { email_invited: "partner@example.com", role: "partner" },
      },
    );
    await createUser(harness, "partner@example.com", "Partner");
    const partner = await loginWithMagicLink(harness, "partner@example.com");
    const accepted = await api(harness, `/api/invites/${invite.data.invite.token}/accept`, {
      token: partner.token,
      method: "POST",
      body: {},
    });
    expect(accepted.status).toBe(200);

    const thirdAdult = await api(harness, `/api/households/${owner.householdId}/invites`, {
      token: owner.token,
      headers: { "X-Step-Up-Token": stepUpToken },
      body: { email_invited: "third@example.com", role: "partner" },
    });
    expect(thirdAdult.status).toBe(409);
  });

  it("only the owner can change member roles", async () => {
    const members = await api<{ items: Array<{ id: string; role: string; user: string }> }>(
      harness,
      `/api/households/${owner.householdId}/members`,
      { token: owner.token },
    );
    const partnerMember = members.data.items.find((member) => member.role === "partner");
    expect(partnerMember).toBeTruthy();

    const partnerSession = await loginWithMagicLink(harness, "partner@example.com");
    const denied = await api(
      harness,
      `/api/households/${owner.householdId}/members/${partnerMember?.id}`,
      {
        token: partnerSession.token,
        method: "PATCH",
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { role: "viewer" },
      },
    );
    expect(denied.status).toBe(403);
  });
});
