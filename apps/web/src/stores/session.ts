import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { Role } from "@cf/shared";
import { apiClient } from "../api/client";
import { clearTokens, loadTokens, saveTokens } from "../api/tokens";

export interface MeUser {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export interface Membership {
  id: string;
  household: string;
  user: string;
  role: Role;
  invite_status: "pending" | "accepted";
  permissions: Record<string, unknown>;
  household_name?: string;
}

export interface MeResponse {
  user: MeUser;
  memberships: Membership[];
  twofa_enabled: boolean;
}

interface AuthResult {
  token: string;
  refresh_token: string;
  step_up_required: boolean;
  step_up_token?: string;
  trusted_device?: boolean;
}

export const useSessionStore = defineStore("session", () => {
  const initialized = ref(false);
  const user = ref<MeUser | null>(null);
  const memberships = ref<Membership[]>([]);
  const twofaEnabled = ref(false);
  const currentHouseholdId = ref<string | null>(null);
  const stepUpRequired = ref(false);
  const loading = ref(false);

  const isAuthenticated = computed(() => Boolean(loadTokens()?.token && user.value));
  const currentMembership = computed(
    () =>
      memberships.value.find((membership) => membership.household === currentHouseholdId.value) ??
      memberships.value[0] ??
      null,
  );
  const currentRole = computed<Role | null>(() => currentMembership.value?.role ?? null);
  const hasHousehold = computed(() => memberships.value.length > 0);

  function persistAuth(result: AuthResult): void {
    saveTokens({
      token: result.token,
      refreshToken: result.refresh_token,
      stepUpToken: result.step_up_token,
      stepUpExpiresAt: result.step_up_token ? Date.now() + 10 * 60 * 1000 : undefined,
    });
    stepUpRequired.value = result.step_up_required;
  }

  async function requestMagicLink(email: string): Promise<void> {
    await apiClient.post("/auth/magic-link/request", { email }, { auth: false });
  }

  async function verifyMagicLink(token: string, deviceLabel: string): Promise<AuthResult> {
    const result = await apiClient.post<AuthResult>(
      "/auth/magic-link/verify",
      { token, device_label: deviceLabel },
      { auth: false },
    );
    persistAuth(result);
    if (!result.step_up_required) await loadMe();
    return result;
  }

  async function verify2fa(
    sessionToken: string,
    code: string,
    kind: "totp" | "recovery",
    rememberDevice: boolean,
  ): Promise<AuthResult> {
    const result = await apiClient.post<AuthResult>(
      "/auth/2fa/verify",
      { session_token: sessionToken, code, kind, remember_device: rememberDevice },
      { auth: false },
    );
    persistAuth(result);
    await loadMe();
    return result;
  }

  async function loadMe(): Promise<void> {
    loading.value = true;
    try {
      const me = await apiClient.get<MeResponse>("/auth/me");
      user.value = me.user;
      memberships.value = me.memberships;
      twofaEnabled.value = me.twofa_enabled;
      if (!currentHouseholdId.value && me.memberships[0]) {
        currentHouseholdId.value = me.memberships[0].household;
      }
      initialized.value = true;
    } finally {
      loading.value = false;
    }
  }

  function setHousehold(id: string): void {
    currentHouseholdId.value = id;
  }

  function setStepUp(token: string): void {
    const tokens = loadTokens();
    if (!tokens) return;
    saveTokens({ ...tokens, stepUpToken: token, stepUpExpiresAt: Date.now() + 10 * 60 * 1000 });
    stepUpRequired.value = false;
  }

  async function logout(): Promise<void> {
    try {
      if (loadTokens()?.token) await apiClient.post("/auth/logout", {});
    } finally {
      clearTokens();
      user.value = null;
      memberships.value = [];
      currentHouseholdId.value = null;
      initialized.value = false;
    }
  }

  return {
    initialized,
    user,
    memberships,
    twofaEnabled,
    currentHouseholdId,
    stepUpRequired,
    loading,
    isAuthenticated,
    currentMembership,
    currentRole,
    hasHousehold,
    requestMagicLink,
    verifyMagicLink,
    verify2fa,
    loadMe,
    setHousehold,
    setStepUp,
    logout,
  };
});
