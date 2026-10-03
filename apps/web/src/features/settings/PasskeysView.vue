<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Fingerprint, Trash2 } from "lucide-vue-next";
import { authApi, type PasskeyRecord } from "@/api/auth-api";
import { useToast } from "@/composables/useToast";
import { formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";

const toast = useToast();
const passkeys = ref<PasskeyRecord[]>([]);
const loading = ref(false);

function base64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function challengeBuffer(): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer;
}

const supported =
  typeof window !== "undefined" &&
  Boolean(window.PublicKeyCredential) &&
  Boolean(navigator.credentials);

async function load(): Promise<void> {
  loading.value = true;
  try {
    passkeys.value = (await authApi.listPasskeys()).items;
  } finally {
    loading.value = false;
  }
}

async function register(): Promise<void> {
  if (!supported) {
    toast.error("Este dispositivo não suporta passkeys.");
    return;
  }
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: challengeBuffer(),
        rp: { name: "Controle Financeiro Familiar" },
        user: {
          id: challengeBuffer(),
          name: "passkey",
          displayName: "Passkey",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 },
        ],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60_000,
      },
    })) as { rawId: ArrayBuffer } | null;
    if (!credential) return;
    await authApi.registerPasskey({
      id: base64Url(credential.rawId),
      label: (navigator.userAgent || "Dispositivo").slice(0, 80),
    });
    toast.success("Passkey cadastrada.");
    await load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Não foi possível registrar a passkey.");
  }
}

async function revoke(id: string): Promise<void> {
  try {
    await authApi.revokePasskey(id);
    toast.info("Passkey removida.");
    await load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao remover.");
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Segurança</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Passkeys</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Chaves de acesso</CardTitle>
        <CardDescription>
          Cadastre passkeys do dispositivo para agilizar o desbloqueio. O step-up continua
          exigindo TOTP nesta versão.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <Button :disabled="!supported" @click="register">
          <Fingerprint class="h-4 w-4" /> Cadastrar este dispositivo
        </Button>
        <p v-if="!supported" class="text-xs text-muted-foreground">
          Este dispositivo/navegador não suporta passkeys.
        </p>

        <p v-if="passkeys.length === 0" class="text-sm text-muted-foreground">
          Nenhuma passkey cadastrada.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="item in passkeys"
            :key="item.id"
            class="flex items-center justify-between py-3 text-sm"
          >
            <div>
              <p class="font-bold">{{ item.label }}</p>
              <p class="text-xs text-muted-foreground">
                {{ item.created_at ? formatDateTime(item.created_at) : "" }}
              </p>
            </div>
            <Button size="sm" variant="ghost" @click="revoke(item.id)">
              <Trash2 class="h-3.5 w-3.5" /> Revogar
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
