export interface NotifierConfig {
  pocketbaseUrl: string;
  adminEmail: string;
  adminPassword: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
  cron: string;
  timezone: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotifierConfig {
  return {
    pocketbaseUrl: env.CF_POCKETBASE_URL || "http://127.0.0.1:8090",
    adminEmail: env.CF_POCKETBASE_ADMIN_EMAIL || "",
    adminPassword: env.CF_POCKETBASE_ADMIN_PASSWORD || "",
    vapidPublicKey: env.CF_VAPID_PUBLIC_KEY || "",
    vapidPrivateKey: env.CF_VAPID_PRIVATE_KEY || "",
    vapidSubject: env.CF_VAPID_SUBJECT || "mailto:admin@controle-financeiro.local",
    cron: env.CF_NOTIFIER_CRON || "0 * * * *",
    timezone: env.CF_TIMEZONE || "America/Sao_Paulo",
  };
}

export function hasVapid(config: NotifierConfig): boolean {
  return Boolean(config.vapidPublicKey && config.vapidPrivateKey);
}
