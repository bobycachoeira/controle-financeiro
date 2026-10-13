import { defineStore } from "pinia";
import { ref } from "vue";
import type { Role } from "@cf/shared";
import { householdApi, type JoinRequest, type MemberRecord } from "../api/household-api";
import { useSessionStore } from "./session";

export const useHouseholdStore = defineStore("household", () => {
  const members = ref<MemberRecord[]>([]);
  const joinRequests = ref<JoinRequest[]>([]);
  const loading = ref(false);

  async function createHousehold(name: string): Promise<string> {
    const result = await householdApi.create(name);
    const session = useSessionStore();
    await session.loadMe();
    session.setHousehold(result.household.id);
    return result.household.id;
  }

  async function loadMembers(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    loading.value = true;
    try {
      const result = await householdApi.listMembers(session.currentHouseholdId);
      members.value = result.items;
    } finally {
      loading.value = false;
    }
  }

  async function createInvite(email: string, role: Role): Promise<string> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    const result = await householdApi.createInvite(session.currentHouseholdId, email, role);
    return result.invite.id;
  }

  async function loadJoinRequests(): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) return;
    const result = await householdApi.listJoinRequests(session.currentHouseholdId);
    joinRequests.value = result.items;
  }

  async function approveJoinRequest(memberId: string, role: Role, personKey?: string): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    await householdApi.approveJoinRequest(session.currentHouseholdId, memberId, role, personKey);
    await Promise.all([loadJoinRequests(), loadMembers()]);
  }

  async function rejectJoinRequest(memberId: string): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    await householdApi.rejectJoinRequest(session.currentHouseholdId, memberId);
    await loadJoinRequests();
  }

  async function updateMemberRole(memberId: string, role: Role): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    await householdApi.updateMemberRole(session.currentHouseholdId, memberId, role);
    await loadMembers();
  }

  async function updateMemberPermissions(
    memberId: string,
    permissions: Record<string, unknown>,
  ): Promise<void> {
    const session = useSessionStore();
    if (!session.currentHouseholdId) throw new Error("Sem household");
    await householdApi.updateMemberPermissions(session.currentHouseholdId, memberId, permissions);
    await loadMembers();
  }

  return {
    members,
    joinRequests,
    loading,
    createHousehold,
    loadMembers,
    createInvite,
    loadJoinRequests,
    approveJoinRequest,
    rejectJoinRequest,
    updateMemberRole,
    updateMemberPermissions,
  };
});
