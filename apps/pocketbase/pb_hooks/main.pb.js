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

routerAdd("GET", "/api/households/{id}/join-requests", (c) =>
  require(`${__hooks}/lib/handlers/join-requests.js`).list(c),
);
routerAdd("POST", "/api/households/{id}/join-requests/{memberId}/approve", (c) =>
  require(`${__hooks}/lib/handlers/join-requests.js`).approve(c),
);
routerAdd("POST", "/api/households/{id}/join-requests/{memberId}/reject", (c) =>
  require(`${__hooks}/lib/handlers/join-requests.js`).reject(c),
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

routerAdd("GET", "/api/settings/features", (c) => require(`${__hooks}/lib/handlers/features.js`).features(c));

routerAdd("GET", "/api/auth/passkeys", (c) =>
  require(`${__hooks}/lib/handlers/passkeys.js`).list(c),
);
routerAdd("POST", "/api/auth/passkeys", (c) =>
  require(`${__hooks}/lib/handlers/passkeys.js`).register(c),
);
routerAdd("DELETE", "/api/auth/passkeys/{id}", (c) =>
  require(`${__hooks}/lib/handlers/passkeys.js`).remove(c),
);

routerAdd("POST", "/api/recurrences/run", (c) =>
  require(`${__hooks}/lib/handlers/recurrences.js`).runHandler(c),
);

routerAdd("POST", "/api/bills/generate", (c) =>
  require(`${__hooks}/lib/handlers/recurrences.js`).runHouseholdHandler(c),
);

cronAdd("recurrences", "0 3 * * *", () => {
  require(`${__hooks}/lib/handlers/recurrences.js`).run();
});

onBootstrap((e) => {
  e.next();

  // Configura o SMTP do PocketBase a partir das variáveis CF_MAIL_*,
  // permitindo enviar Magic Link sem configurar manualmente no painel.
  try {
    const host = $os.getenv("CF_MAIL_HOST");
    if (host) {
      const settings = e.app.settings();
      settings.smtp.enabled = true;
      settings.smtp.host = host;
      settings.smtp.port = Number($os.getenv("CF_MAIL_PORT") || 587);
      const user = $os.getenv("CF_MAIL_USER");
      const pass = $os.getenv("CF_MAIL_PASSWORD");
      if (user) settings.smtp.username = user;
      if (pass) settings.smtp.password = pass;
      const from = $os.getenv("CF_MAIL_FROM");
      if (from) settings.meta.senderAddress = from;
      const appUrl = $os.getenv("CF_APP_URL");
      if (appUrl) settings.meta.appURL = appUrl;
      e.app.save(settings);
      console.log("SMTP configurado via CF_MAIL_* (" + host + ")");
    }
  } catch (err) {
    console.log("Falha ao configurar SMTP: " + String(err));
  }
});
