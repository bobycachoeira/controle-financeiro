import type { NotificationPreferences } from "@cf/shared";
import { apiClient } from "./client";

export interface PreferencesResponse {
  push_enabled: boolean;
  preferences: NotificationPreferences;
  subscriptions_count?: number;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  label?: string;
}

export interface SubscriptionResponse {
  subscription: { id: string; label: string; last_seen_at: string | null; revoked_at: string | null };
}

export interface DeliveryRecord {
  id: string;
  kind: string;
  entity: string;
  entity_id: string;
  scheduled_date: string | null;
  status: string;
  sent_at: string | null;
}

export const notificationsApi = {
  vapidPublicKey: () =>
    apiClient.get<{ public_key: string }>("/notifications/vapid-public-key", { auth: false }),
  getPreferences: () => apiClient.get<PreferencesResponse>("/notifications/preferences"),
  updatePreferences: (preferences: NotificationPreferences, pushEnabled?: boolean) =>
    apiClient.put<PreferencesResponse>("/notifications/preferences", {
      preferences,
      ...(pushEnabled === undefined ? {} : { push_enabled: pushEnabled }),
    }),
  subscribe: (input: PushSubscriptionInput) =>
    apiClient.post<SubscriptionResponse>("/notifications/subscriptions", input),
  unsubscribe: (id: string) => apiClient.del<void>(`/notifications/subscriptions/${id}`),
  sendTest: () => apiClient.post<{ ok: boolean; delivery_id: string }>("/notifications/test", {}),
  coverage: (amountCents: number, note?: string) =>
    apiClient.post<{ ok: boolean; sent_to: number }>("/notifications/coverage", {
      amount_cents: amountCents,
      note: note ?? "",
    }),
  deliveries: () => apiClient.get<{ items: DeliveryRecord[] }>("/notifications/deliveries"),
};
