<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";

const session = useSessionStore();
const sync = useSyncStore();
const router = useRouter();
const toast = useToast();

const links = [
  { name: "transfers", label: "Transferências" },
  { name: "bills", label: "Contas a pagar/receber" },
  { name: "recurrences", label: "Recorrências" },
  { name: "budgets", label: "Orçamentos" },
  { name: "import", label: "Importar extrato" },
  { name: "currencies", label: "Moedas e cotações" },
  { name: "integrations", label: "Integrações" },
  { name: "categories", label: "Categorias" },
  { name: "invites", label: "Família e convites" },
  { name: "notifications", label: "Notificações" },
  { name: "devices", label: "Segurança e dispositivos" },
  { name: "app-lock", label: "App Lock" },
];

async function syncNow(): Promise<void> {
  await sync.syncNow();
  toast.success("Sincronização concluída.");
}

async function logout(): Promise<void> {
  await session.logout();
  router.push({ name: "login" });
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Mais</h1>

    <Card>
      <CardContent class="divide-y p-0">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="block px-4 py-3 text-sm hover:bg-accent"
        >
          {{ link.label }}
        </RouterLink>
      </CardContent>
    </Card>

    <div class="flex flex-col gap-2">
      <Button variant="outline" :disabled="sync.syncing || !sync.online" @click="syncNow">
        Sincronizar agora
      </Button>
      <Button variant="ghost" @click="logout">Sair</Button>
    </div>
  </div>
</template>
