<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";

const session = useSessionStore();
const router = useRouter();
const toast = useToast();
const checking = ref(false);

async function check(): Promise<void> {
  checking.value = true;
  try {
    await session.loadMe();
    if (session.hasHousehold) {
      router.push({ name: "dashboard" });
    } else {
      toast.info("Ainda aguardando aprovação do administrador.");
    }
  } catch {
    toast.error("Não foi possível verificar agora.");
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
    <Card>
      <CardHeader>
        <CardTitle>Aguardando aprovação</CardTitle>
      </CardHeader>
      <CardContent class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Seu pedido para entrar na família foi enviado. O titular precisa aprovar seu acesso e
          definir seu papel antes que você possa usar o app.
        </p>
        <Button class="w-full" :loading="checking" @click="check">Verificar novamente</Button>
        <Button variant="outline" class="w-full" @click="session.logout()">Sair</Button>
      </CardContent>
    </Card>
  </div>
</template>
