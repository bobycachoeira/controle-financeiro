<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/api/client";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const session = useSessionStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();

const email = ref("");
const requesting = ref(false);
const sent = ref(false);
const verifying = ref(false);
const token = computed(() => (typeof route.query.token === "string" ? route.query.token : ""));

function deviceLabel(): string {
  return (navigator.userAgent || "Dispositivo").slice(0, 80);
}

async function requestLink(): Promise<void> {
  requesting.value = true;
  try {
    await session.requestMagicLink(email.value);
    sent.value = true;
    toast.success("Se o e-mail existir, enviaremos o link de acesso.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao solicitar o link.");
  } finally {
    requesting.value = false;
  }
}

async function verifyLink(): Promise<void> {
  verifying.value = true;
  try {
    const result = await session.verifyMagicLink(token.value, deviceLabel());
    if (result.step_up_required) {
      router.push({ name: "2fa" });
      return;
    }
    const pendingInvite = sessionStorage.getItem("cf.pendingInvite");
    if (pendingInvite) {
      router.push({ name: "join", query: { token: pendingInvite } });
      return;
    }
    router.push({
      name: session.hasHousehold ? "dashboard" : session.hasPending ? "pending" : "onboarding",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) {
      toast.error("Este link expirou ou já foi usado. Solicite um novo.");
    } else {
      toast.error(error instanceof Error ? error.message : "Falha ao validar o link.");
    }
  } finally {
    verifying.value = false;
  }
}

onMounted(() => {
  if (token.value) void verifyLink();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Controle Financeiro Familiar</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Acesso sem senha por link mágico enviado ao seu e-mail.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
      </CardHeader>
      <CardContent>
        <form v-if="!sent && !token" class="space-y-4" @submit.prevent="requestLink">
          <div class="space-y-2">
            <Label for="email">E-mail</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              autocomplete="email"
              required
              placeholder="voce@exemplo.com"
            />
          </div>
          <Button type="submit" class="w-full" :loading="requesting">Enviar link de acesso</Button>
        </form>

        <p v-else-if="verifying" class="text-sm text-muted-foreground">Validando seu link…</p>

        <div v-else class="space-y-4">
          <p class="text-sm text-muted-foreground">
            Enviamos um link para <strong>{{ email }}</strong>. Abra o e-mail neste dispositivo para
            concluir o acesso.
          </p>
          <Button variant="outline" class="w-full" @click="sent = false">Enviar novamente</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
