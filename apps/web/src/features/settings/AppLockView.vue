<script setup lang="ts">
import { ref } from "vue";
import { useAppLock } from "@/composables/useAppLock";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import Select from "@/components/ui/Select.vue";
import Label from "@/components/ui/Label.vue";

const appLock = useAppLock();
const toast = useToast();
const timeout = ref(String(appLock.timeoutMs.value));

async function toggle(): Promise<void> {
  if (appLock.enabled.value) {
    appLock.disable();
    toast.info("App Lock desativado.");
    return;
  }
  const ok = await appLock.enable(Number(timeout.value));
  if (ok) {
    toast.success("App Lock ativado.");
  } else {
    toast.error("Biometria indisponível neste dispositivo. App Lock não foi ativado.");
  }
}

async function testUnlock(): Promise<void> {
  const ok = await appLock.unlock();
  if (ok) toast.success("Desbloqueado.");
  else toast.error("Não foi possível autenticar.");
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">App Lock</h1>

    <Card>
      <CardHeader>
        <CardTitle>Bloqueio por biometria</CardTitle>
        <CardDescription>
          Exige reautenticação biométrica após um período de inatividade.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <p v-if="!appLock.supported.value" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Biometria não disponível neste dispositivo. O bloqueio não será ativado.
        </p>

        <div class="space-y-2">
          <Label for="applock-timeout">Tempo de inatividade</Label>
          <Select id="applock-timeout" v-model="timeout">
            <option value="60000">1 minuto</option>
            <option value="300000">5 minutos</option>
            <option value="900000">15 minutos</option>
          </Select>
        </div>

        <div class="flex gap-2">
          <Button @click="toggle">
            {{ appLock.enabled.value ? "Desativar" : "Ativar App Lock" }}
          </Button>
          <Button v-if="appLock.enabled.value" variant="outline" @click="testUnlock">
            Testar desbloqueio
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
