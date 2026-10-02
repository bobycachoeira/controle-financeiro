import { apiClient } from "./client";

export interface TwoFactorSetup {
  otpauth_uri: string;
  secret: string;
}

export interface ConfirmTwoFactorResult {
  recovery_codes: string[];
}

export interface TrustedDevice {
  id: string;
  label: string;
  last_seen_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export const authApi = {
  setup2fa: () => apiClient.post<TwoFactorSetup>("/auth/2fa/setup", {}, { stepUp: true }),
  confirm2fa: (code: string) =>
    apiClient.post<ConfirmTwoFactorResult>("/auth/2fa/confirm", { code }, { stepUp: true }),
  disable2fa: (code: string) =>
    apiClient.post<void>("/auth/2fa/disable", { code }, { stepUp: true }),
  listDevices: () => apiClient.get<{ items: TrustedDevice[] }>("/auth/devices"),
  trustDevice: () => apiClient.post<TrustedDevice>("/auth/devices", {}),
  revokeDevice: (id: string) => apiClient.del<void>(`/auth/devices/${id}`),
};
