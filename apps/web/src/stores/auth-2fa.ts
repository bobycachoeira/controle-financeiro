import { defineStore } from "pinia";
import { ref } from "vue";
import { authApi, type TrustedDevice, type TwoFactorSetup } from "../api/auth-api";
import { useSessionStore } from "./session";

export const useAuth2faStore = defineStore("auth-2fa", () => {
  const setupData = ref<TwoFactorSetup | null>(null);
  const recoveryCodes = ref<string[]>([]);
  const devices = ref<TrustedDevice[]>([]);
  const loading = ref(false);

  async function startSetup(): Promise<TwoFactorSetup> {
    const data = await authApi.setup2fa();
    setupData.value = data;
    return data;
  }

  async function confirmSetup(code: string): Promise<string[]> {
    const result = await authApi.confirm2fa(code);
    recoveryCodes.value = result.recovery_codes;
    const session = useSessionStore();
    session.twofaEnabled = true;
    return result.recovery_codes;
  }

  async function disable(code: string): Promise<void> {
    await authApi.disable2fa(code);
    const session = useSessionStore();
    session.twofaEnabled = false;
    recoveryCodes.value = [];
    setupData.value = null;
  }

  async function loadDevices(): Promise<void> {
    loading.value = true;
    try {
      const result = await authApi.listDevices();
      devices.value = result.items;
    } finally {
      loading.value = false;
    }
  }

  async function trustCurrentDevice(): Promise<void> {
    const device = await authApi.trustDevice();
    devices.value = [...devices.value, device];
  }

  async function revokeDevice(id: string): Promise<void> {
    await authApi.revokeDevice(id);
    devices.value = devices.value.map((device) =>
      device.id === id ? { ...device, revoked_at: new Date().toISOString() } : device,
    );
  }

  function clearRecoveryCodes(): void {
    recoveryCodes.value = [];
    setupData.value = null;
  }

  return {
    setupData,
    recoveryCodes,
    devices,
    loading,
    startSetup,
    confirmSetup,
    disable,
    loadDevices,
    trustCurrentDevice,
    revokeDevice,
    clearRecoveryCodes,
  };
});
