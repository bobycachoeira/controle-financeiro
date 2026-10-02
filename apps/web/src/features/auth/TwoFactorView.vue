<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { loadTokens } from "@/api/tokens";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const session = useSessionStore();
const router = useRouter();
const toast = useToast();

const code = ref("");
const kind = ref<"totp" | "recovery">("totp");
const rememberDevice = ref(false);
const loading = ref(false);

async function submit(): Promise<void> {
  const sessionToken = loadTokens()?.token;
  if (!sessionToken) {
    router.push({ name: "login" });
    return;
  }
  loading.value = true;
  try {
    await session.verify2fa(sessionToken, code.value, kind.value, rememberDevice.value);
    toast.success("Verificação concluída.");
    router.push({ name: session.hasHousehold ? "dashboard" : "onboarding" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Código inválido.");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Verificação em duas etapas</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Informe o código do seu aplicativo autenticador.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Confirme o acesso</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="code">
              {{ kind === "totp" ? "Código TOTP (6 dígitos)" : "Código de recuperação" }}
            </Label>
            <Input
              id="code"
              v-model="code"
              :inputmode="kind === 'totp' ? 'numeric' : 'text'"
              autocomplete="one-time-code"
              required
            />
          </div>

          <label class="flex items-center gap-2 text-sm">
            <input v-model="rememberDevice" type="checkbox" class="h-4 w-4 rounded border-input" />
            Confiar neste dispositivo por 30 dias
          </label>

          <Button type="submit" class="w-full" :loading="loading">Verificar</Button>

          <button
            type="button"
            class="w-full text-center text-sm text-primary underline"
            @click="kind = kind === 'totp' ? 'recovery' : 'totp'"
          >
            {{ kind === "totp" ? "Usar código de recuperação" : "Usar aplicativo autenticador" }}
          </button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
