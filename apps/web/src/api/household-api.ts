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
  user_name?: string;
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
  updateMemberRole: (household: string, memberId: string, role: string) =>
    apiClient.patch<{ member: { id: string; role: string } }>(
      `/households/${household}/members/${memberId}`,
      { role },
      { stepUp: true },
    ),
  updateMemberPermissions: (household: string, memberId: string, permissions: Record<string, unknown>) =>
    apiClient.patch<{ member: { id: string; role: string; permissions: Record<string, unknown> } }>(
      `/households/${household}/members/${memberId}`,
      { permissions },
      { stepUp: true },
    ),
  createInvite: (household: string, email: string, role: string) =>
    apiClient.post<{ invite: InviteRecord }>(
      `/households/${household}/invites`,
      { email_invited: email, role },
      { stepUp: true },
    ),
  acceptInvite: (token: string) =>
    apiClient.post<{ member: MemberRecord }>(`/invites/${token}/accept`, {}, { auth: true }),
  listJoinRequests: (household: string) =>
    apiClient.get<{ items: JoinRequest[] }>(`/households/${household}/join-requests`),
  approveJoinRequest: (household: string, memberId: string, role: string, personKey?: string) =>
    apiClient.post<{ member: MemberRecord }>(
      `/households/${household}/join-requests/${memberId}/approve`,
      { role, person_key: personKey ?? null },
      { stepUp: true },
    ),
  rejectJoinRequest: (household: string, memberId: string) =>
    apiClient.post<void>(`/households/${household}/join-requests/${memberId}/reject`, {}, { stepUp: true }),
};

export interface JoinRequest {
  id: string;
  user: string;
  user_name: string;
  email: string;
  role_suggested: string;
  created: string | null;
}
