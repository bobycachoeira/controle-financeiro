/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

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
      icon: "/pwa-192.png",
      badge: "/pwa-192.png",
      data: payload.data ?? {},
    }),
  );
});

self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) return (existing as WindowClient).focus();
      return self.clients.openWindow("/");
    }),
  );
});
