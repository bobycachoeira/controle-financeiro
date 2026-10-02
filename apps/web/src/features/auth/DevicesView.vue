<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useAuth2faStore } from "@/stores/auth-2fa";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/api/client";
import { formatDateTime } from "@/lib/format";
import StepUpDialog from "./StepUpDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const tfa = useAuth2faStore();
const session = useSessionStore();
const toast = useToast();

const confirmCode = ref("");
const stepUpOpen = ref(false);
const pendingAction = ref<null | (() => Promise<void>)>(null);

async function withStepUp(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof ApiError && error.isStepUpRequired) {
      pendingAction.value = action;
      stepUpOpen.value = true;
      return;
    }
    toast.error(error instanceof Error ? error.message : "Falha na operação.");
  }
}

async function onStepUpVerified(): Promise<void> {
  const action = pendingAction.value;
  pendingAction.value = null;
  if (action) await action();
}

async function startSetup(): Promise<void> {
  await withStepUp(async () => {
    await tfa.startSetup();
  });
}

async function confirmSetup(): Promise<void> {
  try {
    await tfa.confirmSetup(confirmCode.value);
    toast.success("2FA ativado. Guarde seus códigos de recuperação.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Código inválido.");
  }
}

async function disable2fa(): Promise<void> {
  await withStepUp(async () => {
    await tfa.disable(confirmCode.value);
    toast.success("2FA desativado.");
  });
}

async function trustDevice(): Promise<void> {
  try {
    await tfa.trustCurrentDevice();
    toast.success("Dispositivo marcado como confiável.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao confiar no dispositivo.");
  }
}

async function revoke(id: string): Promise<void> {
  try {
    await tfa.revokeDevice(id);
    toast.success("Dispositivo revogado.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao revogar.");
  }
}

onMounted(() => {
  void tfa.loadDevices();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">Segurança</h1>
      <p class="text-sm text-muted-foreground">2FA, códigos de recuperação e dispositivos.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Verificação em duas etapas</CardTitle>
        <CardDescription>
          {{ session.twofaEnabled ? "2FA está ativo." : "2FA está desativado." }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <template v-if="!session.twofaEnabled">
          <div v-if="!tfa.setupData">
            <Button @click="startSetup">Ativar 2FA</Button>
          </div>
          <div v-else class="space-y-3">
            <p class="text-sm">
              Adicione a chave abaixo no seu aplicativo autenticador e confirme com o código gerado.
            </p>
            <p class="break-all rounded-md bg-secondary p-2 font-mono text-xs">{{ tfa.setupData.secret }}</p>
            <p class="break-all text-xs text-muted-foreground">{{ tfa.setupData.otpauth_uri }}</p>
            <div class="space-y-2">
              <Label for="confirm-code">Código de confirmação</Label>
              <Input id="confirm-code" v-model="confirmCode" inputmode="numeric" />
            </div>
            <Button @click="confirmSetup">Confirmar ativação</Button>
          </div>

          <div v-if="tfa.recoveryCodes.length > 0" class="space-y-2 rounded-md border border-amber-300 p-3">
            <p class="text-sm font-medium">Guarde estes códigos (exibidos uma única vez):</p>
            <ul class="grid grid-cols-2 gap-1 font-mono text-xs">
              <li v-for="recoveryCode in tfa.recoveryCodes" :key="recoveryCode">{{ recoveryCode }}</li>
            </ul>
            <Button size="sm" variant="outline" @click="tfa.clearRecoveryCodes">Já guardei</Button>
          </div>
        </template>

        <template v-else>
          <div class="space-y-2">
            <Label for="disable-code">Código 2FA para desativar</Label>
            <Input id="disable-code" v-model="confirmCode" inputmode="numeric" />
          </div>
          <Button variant="destructive" @click="disable2fa">Desativar 2FA</Button>
        </template>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Dispositivos confiáveis</CardTitle>
        <CardDescription>Dispositivos que não pedem 2FA por 30 dias.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <Button size="sm" variant="outline" @click="trustDevice">Confiar neste dispositivo</Button>
        <ul class="divide-y">
          <li
            v-for="device in tfa.devices"
            :key="device.id"
            class="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p class="font-medium">{{ device.label }}</p>
              <p class="text-xs text-muted-foreground">
                Expira em {{ device.expires_at ? formatDateTime(device.expires_at) : "—" }}
              </p>
            </div>
            <Button
              v-if="!device.revoked_at"
              size="sm"
              variant="ghost"
              @click="revoke(device.id)"
            >
              Revogar
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>

    <StepUpDialog v-model="stepUpOpen" @verified="onStepUpVerified" />
  </div>
</template>
