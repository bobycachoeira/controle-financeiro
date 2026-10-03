import { apiClient } from "./client";

export interface FeatureFlags {
  open_finance_enabled: boolean;
  passkeys_enabled: boolean;
}

export const featuresApi = {
  flags: () => apiClient.get<FeatureFlags>("/settings/features", { auth: false }),
};
