import { defineStore } from "pinia";
import { computed, ref } from "vue";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesSchema,
  type NotificationPreferences,
} from "@cf/shared";
import { notificationsApi, type DeliveryRecord } from "../api/notifications-api";
import { disablePush, enablePush, isPushSupported } from "../composables/usePushNotifications";
import { getMeta, setMeta } from "../db/schema";
import { useSessionStore } from "./session";

export const useNotificationsStore = defineStore("notifications", () => {
  const preferences = ref<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const pushEnabled = ref(false);
  const subscriptionsCount = ref(0);
  const deliveries = ref<DeliveryRecord[]>([]);
  const loading = ref(false);
  const supported = ref(isPushSupported());

  const canTest = computed(() => pushEnabled.value && subscriptionsCount.value > 0);

  function cacheKey(): string {
    const session = useSessionStore();
    return `notifications:${session.currentHouseholdId ?? "default"}`;
  }

  async function load(): Promise<void> {
    loading.value = true;
    try {
      const result = await notificationsApi.getPreferences();
      preferences.value = notificationPreferencesSchema.parse(result.preferences);
      pushEnabled.value = result.push_enabled;
      subscriptionsCount.value = result.subscriptions_count ?? 0;
      await setMeta(
        cacheKey(),
        JSON.stringify({
          preferences: preferences.value,
          push_enabled: pushEnabled.value,
          subscriptions_count: subscriptionsCount.value,
        }),
      );
    } catch (error) {
      const cached = await getMeta(cacheKey());
      if (cached) {
        const parsed = JSON.parse(cached) as {
          preferences: unknown;
          push_enabled: boolean;
          subscriptions_count: number;
        };
        preferences.value = notificationPreferencesSchema.parse(parsed.preferences);
        pushEnabled.value = parsed.push_enabled;
        subscriptionsCount.value = parsed.subscriptions_count;
      } else {
        throw error;
      }
    } finally {
      loading.value = false;
    }
  }

  async function save(next: NotificationPreferences): Promise<void> {
    const parsed = notificationPreferencesSchema.parse(next);
    const result = await notificationsApi.updatePreferences(parsed, pushEnabled.value);
    preferences.value = notificationPreferencesSchema.parse(result.preferences);
    pushEnabled.value = result.push_enabled;
  }

  async function enable(): Promise<{ ok: boolean; reason?: string; detail?: string }> {
    const result = await enablePush();
    if (!result.ok) return result;
    pushEnabled.value = true;
    subscriptionsCount.value += 1;
    return { ok: true };
  }

  async function disable(): Promise<void> {
    await disablePush();
    pushEnabled.value = false;
    subscriptionsCount.value = Math.max(0, subscriptionsCount.value - 1);
  }

  async function sendTest(): Promise<void> {
    await notificationsApi.sendTest();
  }

  async function loadDeliveries(): Promise<void> {
    const result = await notificationsApi.deliveries();
    deliveries.value = result.items;
  }

  return {
    preferences,
    pushEnabled,
    subscriptionsCount,
    deliveries,
    loading,
    supported,
    canTest,
    load,
    save,
    enable,
    disable,
    sendTest,
    loadDeliveries,
  };
});
