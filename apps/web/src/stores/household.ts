import { defineStore } from "pinia";
import { ref } from "vue";
import type { Role } from "@cf/shared";
import { householdApi, type MemberRecord } from "../api/household-api";
import { useSessionStore } from "./session";

export const useHouseholdStore = defineStore("household", () => {
  const members = ref<MemberRecord[]>([]);
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

  return { members, loading, createHousehold, loadMembers, createInvite };
});
