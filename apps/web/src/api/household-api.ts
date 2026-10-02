import { apiClient } from "./client";

export interface HouseholdRecord {
  id: string;
  name: string;
  base_currency: string;
  created_by: string;
  sync_id?: string;
}

export interface MemberRecord {
  id: string;
  household: string;
  user: string;
  role: "owner" | "partner" | "teen" | "child" | "viewer";
  invite_status: "pending" | "accepted";
  permissions: Record<string, unknown>;
}

export interface InviteRecord {
  id: string;
  role: string;
  email_invited: string;
  expires_at: string;
}

export const householdApi = {
  create: (name: string) =>
    apiClient.post<{ household: HouseholdRecord }>("/households", { name }),
  listMembers: (household: string) =>
    apiClient.get<{ items: MemberRecord[] }>(`/households/${household}/members`),
  createInvite: (household: string, email: string, role: string) =>
    apiClient.post<{ invite: InviteRecord }>(
      `/households/${household}/invites`,
      { email_invited: email, role },
      { stepUp: true },
    ),
  acceptInvite: (token: string) =>
    apiClient.post<{ member: MemberRecord }>(`/invites/${token}/accept`, {}, { auth: true }),
};
