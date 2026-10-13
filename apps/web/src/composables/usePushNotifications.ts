import { notificationsApi } from "../api/notifications-api";

const SUBSCRIPTION_ID_KEY = "cf.push.subscriptionId";

export function isPushSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

export function deviceLabel(): string {
  return (navigator.userAgent || "Dispositivo").slice(0, 80);
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string; detail?: string }> {
  try {
    if (!isPushSupported()) return { ok: false, reason: "unsupported" };
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return { ok: false, reason: "denied" };

    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("service worker não ficou pronto")), 10000),
      ),
    ]);

    const { public_key } = await notificationsApi.vapidPublicKey();
    if (!public_key) return { ok: false, reason: "no_vapid_key" };

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as unknown as BufferSource,
    });
    const json = subscription.toJSON();
    const result = await notificationsApi.subscribe({
      endpoint: subscription.endpoint,
      keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
      label: deviceLabel(),
    });
    localStorage.setItem(SUBSCRIPTION_ID_KEY, result.subscription.id);
    return { ok: true };
  } catch (error) {
    console.error("[push] enablePush falhou:", error);
    return {
      ok: false,
      reason: "error",
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) await subscription.unsubscribe();
  const id = localStorage.getItem(SUBSCRIPTION_ID_KEY);
  if (id) {
    try {
      await notificationsApi.unsubscribe(id);
    } finally {
      localStorage.removeItem(SUBSCRIPTION_ID_KEY);
    }
  }
}
