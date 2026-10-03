routerAdd("POST", "/api/auth/magic-link/request", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).magicLinkRequest(c),
);
routerAdd("POST", "/api/auth/magic-link/verify", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).magicLinkVerify(c),
);
routerAdd("POST", "/api/auth/refresh", (c) => require(`${__hooks}/lib/handlers/auth.js`).refresh(c));
routerAdd("GET", "/api/auth/me", (c) => require(`${__hooks}/lib/handlers/auth.js`).me(c));
routerAdd("POST", "/api/auth/logout", (c) => require(`${__hooks}/lib/handlers/auth.js`).logout(c));
routerAdd("POST", "/api/auth/2fa/setup", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).twofaSetup(c),
);
routerAdd("POST", "/api/auth/2fa/confirm", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).twofaConfirm(c),
);
routerAdd("POST", "/api/auth/2fa/verify", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).twofaVerify(c),
);
routerAdd("POST", "/api/auth/2fa/disable", (c) =>
  require(`${__hooks}/lib/handlers/auth.js`).twofaDisable(c),
);

routerAdd("GET", "/api/auth/devices", (c) => require(`${__hooks}/lib/handlers/devices.js`).list(c));
routerAdd("POST", "/api/auth/devices", (c) => require(`${__hooks}/lib/handlers/devices.js`).create(c));
routerAdd("DELETE", "/api/auth/devices/{id}", (c) =>
  require(`${__hooks}/lib/handlers/devices.js`).remove(c),
);

routerAdd("POST", "/api/households", (c) => require(`${__hooks}/lib/handlers/household.js`).create(c));
routerAdd("GET", "/api/households/{id}/members", (c) =>
  require(`${__hooks}/lib/handlers/household.js`).listMembers(c),
);
routerAdd("PATCH", "/api/households/{id}/members/{memberId}", (c) =>
  require(`${__hooks}/lib/handlers/household.js`).updateRole(c),
);
routerAdd("DELETE", "/api/households/{id}/members/{memberId}", (c) =>
  require(`${__hooks}/lib/handlers/household.js`).removeMember(c),
);

routerAdd("POST", "/api/households/{id}/invites", (c) =>
  require(`${__hooks}/lib/handlers/invites.js`).create(c),
);
routerAdd("POST", "/api/invites/{token}/accept", (c) =>
  require(`${__hooks}/lib/handlers/invites.js`).accept(c),
);

routerAdd("POST", "/api/sync/push", (c) => require(`${__hooks}/lib/handlers/sync.js`).push(c));
routerAdd("GET", "/api/sync/pull", (c) => require(`${__hooks}/lib/handlers/sync.js`).pull(c));

routerAdd("GET", "/api/notifications/vapid-public-key", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).vapidPublicKey(c),
);
routerAdd("GET", "/api/notifications/preferences", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).getPreferences(c),
);
routerAdd("PUT", "/api/notifications/preferences", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).updatePreferences(c),
);
routerAdd("POST", "/api/notifications/subscriptions", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).createSubscription(c),
);
routerAdd("DELETE", "/api/notifications/subscriptions/{id}", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).deleteSubscription(c),
);
routerAdd("POST", "/api/notifications/test", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).testNotification(c),
);
routerAdd("GET", "/api/notifications/deliveries", (c) =>
  require(`${__hooks}/lib/handlers/notifications.js`).listDeliveries(c),
);

onBootstrap((e) => {
  e.next();
});
