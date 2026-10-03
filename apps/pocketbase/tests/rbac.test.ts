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

  it("creates a pending request on accept and enforces the two-adult limit at approval", async () => {
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
    const accepted = await api<{ member: { invite_status: string } }>(
      harness,
      `/api/invites/${invite.data.invite.token}/accept`,
      { token: partner.token, method: "POST", body: {} },
    );
    expect(accepted.status).toBe(200);
    expect(accepted.data.member.invite_status).toBe("pending");

    const membersBefore = await api<{ items: Array<{ user: string }> }>(
      harness,
      `/api/households/${owner.householdId}/members`,
      { token: owner.token },
    );
    expect(membersBefore.data.items).toHaveLength(1);

    const requests = await api<{
      items: Array<{ id: string; email: string; role_suggested: string }>;
    }>(harness, `/api/households/${owner.householdId}/join-requests`, { token: owner.token });
    const request = requests.data.items.find((item) => item.email === "partner@example.com");
    expect(request).toBeTruthy();

    // Pendente ainda não conta para o limite de 2 adultos.
    const anotherInvite = await api(harness, `/api/households/${owner.householdId}/invites`, {
      token: owner.token,
      headers: { "X-Step-Up-Token": stepUpToken },
      body: { email_invited: "third@example.com", role: "partner" },
    });
    expect(anotherInvite.status).toBe(201);

    const approved = await api(
      harness,
      `/api/households/${owner.householdId}/join-requests/${request?.id}/approve`,
      {
        token: owner.token,
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { role: "partner" },
      },
    );
    expect(approved.status).toBe(200);

    const membersAfter = await api<{ items: Array<{ role: string }> }>(
      harness,
      `/api/households/${owner.householdId}/members`,
      { token: owner.token },
    );
    expect(membersAfter.data.items.some((member) => member.role === "partner")).toBe(true);

    const fourthAdult = await api(harness, `/api/households/${owner.householdId}/invites`, {
      token: owner.token,
      headers: { "X-Step-Up-Token": stepUpToken },
      body: { email_invited: "fourth@example.com", role: "partner" },
    });
    expect(fourthAdult.status).toBe(409);
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

  it("allows the owner to reject a request", async () => {
    const invite = await api<{ invite: { token: string } }>(
      harness,
      `/api/households/${owner.householdId}/invites`,
      {
        token: owner.token,
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { email_invited: "rejected@example.com", role: "child" },
      },
    );
    await createUser(harness, "rejected@example.com", "Rejected");
    const rejected = await loginWithMagicLink(harness, "rejected@example.com");
    await api(harness, `/api/invites/${invite.data.invite.token}/accept`, {
      token: rejected.token,
      method: "POST",
      body: {},
    });

    const requests = await api<{ items: Array<{ id: string; email: string }> }>(
      harness,
      `/api/households/${owner.householdId}/join-requests`,
      { token: owner.token },
    );
    const request = requests.data.items.find((item) => item.email === "rejected@example.com");
    expect(request).toBeTruthy();

    const removed = await api(
      harness,
      `/api/households/${owner.householdId}/join-requests/${request?.id}/reject`,
      { token: owner.token, headers: { "X-Step-Up-Token": stepUpToken }, method: "POST", body: {} },
    );
    expect(removed.status).toBe(204);

    const after = await api<{ items: Array<{ email: string }> }>(
      harness,
      `/api/households/${owner.householdId}/join-requests`,
      { token: owner.token },
    );
    expect(after.data.items.find((item) => item.email === "rejected@example.com")).toBeUndefined();
  });

  it("rejects an accept from a different e-mail", async () => {
    const invite = await api<{ invite: { token: string } }>(
      harness,
      `/api/households/${owner.householdId}/invites`,
      {
        token: owner.token,
        headers: { "X-Step-Up-Token": stepUpToken },
        body: { email_invited: "someone-else@example.com", role: "child" },
      },
    );
    const partnerSession = await loginWithMagicLink(harness, "partner@example.com");
    const mismatch = await api(harness, `/api/invites/${invite.data.invite.token}/accept`, {
      token: partnerSession.token,
      method: "POST",
      body: {},
    });
    expect(mismatch.status).toBe(403);
  });
});
