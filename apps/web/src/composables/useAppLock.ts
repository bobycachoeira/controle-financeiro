import { computed, ref } from "vue";

const STORAGE_ENABLED = "cf.applock.enabled";
const STORAGE_TIMEOUT = "cf.applock.timeout";
const STORAGE_CREDENTIAL = "cf.applock.credential";

function randomChallenge(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32));
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const enabled = ref(localStorage.getItem(STORAGE_ENABLED) === "1");
const timeoutMs = ref(Number(localStorage.getItem(STORAGE_TIMEOUT) ?? 60_000));
const locked = ref(false);
const supported = ref(
  typeof window !== "undefined" && Boolean(window.PublicKeyCredential) && Boolean(navigator.credentials),
);
let lastActivity = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function startTimer(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (!enabled.value || locked.value) return;
    if (Date.now() - lastActivity > timeoutMs.value) locked.value = true;
  }, 5_000);
}

export function useAppLock() {
  async function register(): Promise<boolean> {
    if (!supported.value) return false;
    try {
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge() as unknown as BufferSource,
          rp: { name: "Controle Financeiro Familiar" },
          user: {
            id: randomChallenge() as unknown as BufferSource,
            name: "app-lock",
            displayName: "App Lock",
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required",
          },
          timeout: 60_000,
        },
      })) as PublicKeyCredential | null;
      if (!credential) return false;
      localStorage.setItem(STORAGE_CREDENTIAL, toBase64Url(credential.rawId));
      return true;
    } catch {
      return false;
    }
  }

  async function unlock(): Promise<boolean> {
    if (!supported.value) {
      locked.value = false;
      return true;
    }
    const stored = localStorage.getItem(STORAGE_CREDENTIAL);
    if (!stored) {
      locked.value = false;
      return true;
    }
    try {
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomChallenge() as unknown as BufferSource,
          allowCredentials: [
            { id: fromBase64Url(stored) as unknown as BufferSource, type: "public-key" },
          ],
          userVerification: "required",
          timeout: 60_000,
        },
      });
      if (assertion) {
        locked.value = false;
        lastActivity = Date.now();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function enable(timeout: number): Promise<boolean> {
    const ok = await register();
    enabled.value = true;
    timeoutMs.value = timeout;
    localStorage.setItem(STORAGE_ENABLED, "1");
    localStorage.setItem(STORAGE_TIMEOUT, String(timeout));
    startTimer();
    return ok;
  }

  function disable(): void {
    enabled.value = false;
    locked.value = false;
    localStorage.removeItem(STORAGE_ENABLED);
    localStorage.removeItem(STORAGE_CREDENTIAL);
  }

  function touch(): void {
    lastActivity = Date.now();
  }

  return {
    enabled: computed(() => enabled.value),
    locked: computed(() => locked.value),
    timeoutMs: computed(() => timeoutMs.value),
    supported: computed(() => supported.value),
    enable,
    disable,
    unlock,
    touch,
  };
}
