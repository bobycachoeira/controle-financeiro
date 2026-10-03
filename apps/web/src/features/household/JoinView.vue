<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { loadTokens } from "@/api/tokens";
import { householdApi } from "@/api/household-api";
import { ApiError } from "@/api/client";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const toast = useToast();

const PENDING_KEY = "cf.pendingInvite";
const status = ref<"working" | "error">("working");
const message = ref("Processando seu convite…");

function token(): string {
  return typeof route.query.token === "string" ? route.query.token : "";
}

async function run(): Promise<void> {
  const value = token();
  if (!value) {
    status.value = "error";
    message.value = "Convite inválido: link sem código.";
    return;
  }
  if (!loadTokens()?.token) {
    sessionStorage.setItem(PENDING_KEY, value);
    router.replace({ name: "login" });
    return;
  }
  try {
    await householdApi.acceptInvite(value);
    sessionStorage.removeItem(PENDING_KEY);
    await session.loadMe();
    toast.success("Pedido enviado! Aguarde a aprovação do titular.");
    router.replace({ name: session.hasHousehold ? "dashboard" : "pending" });
  } catch (error) {
    status.value = "error";
    if (error instanceof ApiError && error.status === 403) {
      message.value = "Este convite foi enviado para outro e-mail. Entre com a conta convidada.";
    } else if (error instanceof ApiError && error.status === 410) {
      message.value = "Este convite expirou ou já foi utilizado. Peça um novo ao titular.";
    } else {
      message.value = error instanceof Error ? error.message : "Não foi possível aceitar o convite.";
    }
  }
}

onMounted(run);
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
    <Card>
      <CardHeader>
        <CardTitle>Convite da família</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">{{ message }}</p>
        <template v-if="status === 'error'">
          <Button class="w-full" @click="router.push({ name: 'login' })">Ir para o login</Button>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
