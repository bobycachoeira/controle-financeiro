/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event: PushEvent) => {
  let payload: { title?: string; body?: string; data?: Record<string, unknown> } = {};
  try {
    payload = event.data ? (event.data.json() as typeof payload) : {};
  } catch {
    payload = { title: "Controle Financeiro Familiar", body: event.data?.text() ?? "" };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Controle Financeiro Familiar", {
      body: payload.body ?? "",
      icon: "/pwa-512.png",
      badge: "/badge.png",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const data = (event.notification.data ?? {}) as { url?: string };
  const target = typeof data.url === "string" && data.url.startsWith("/") ? data.url : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client) as WindowClient | undefined;
      if (existing) {
        return existing.focus().then(() => {
          const wanted = new URL(target, self.location.origin).href;
          if (existing.url !== wanted) return existing.navigate(target);
          return undefined;
        });
      }
      return self.clients.openWindow(target);
    }),
  );
});
