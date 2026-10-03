import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";

const getPreferences = vi.fn();
const updatePreferences = vi.fn();

vi.mock("@/api/notifications-api", () => ({
  notificationsApi: {
    getPreferences: () => getPreferences(),
    updatePreferences: (prefs: unknown, enabled?: boolean) => updatePreferences(prefs, enabled),
    sendTest: vi.fn(),
    deliveries: vi.fn(async () => ({ items: [] })),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    vapidPublicKey: vi.fn(async () => ({ public_key: "x" })),
  },
}));

vi.mock("@/composables/usePushNotifications", () => ({
  isPushSupported: () => true,
  enablePush: vi.fn(async () => ({ ok: true })),
  disablePush: vi.fn(async () => undefined),
  deviceLabel: () => "test",
}));

describe("notifications store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("loads preferences and applies defaults for missing fields", async () => {
    getPreferences.mockResolvedValue({
      push_enabled: true,
      preferences: { horario_envio: "07:00" },
      subscriptions_count: 2,
    });
    const { useNotificationsStore } = await import("@/stores/notifications");
    const store = useNotificationsStore();
    await store.load();
    expect(store.pushEnabled).toBe(true);
    expect(store.subscriptionsCount).toBe(2);
    expect(store.preferences.horario_envio).toBe("07:00");
    expect(store.preferences.quiet_hours.inicio).toBe("22:00");
  });

  it("saves preferences through the API", async () => {
    updatePreferences.mockResolvedValue({ push_enabled: true, preferences: { horario_envio: "09:00" } });
    const { useNotificationsStore } = await import("@/stores/notifications");
    const store = useNotificationsStore();
    await store.save({ ...store.preferences, horario_envio: "09:00" });
    expect(updatePreferences).toHaveBeenCalled();
    expect(store.preferences.horario_envio).toBe("09:00");
  });
});
