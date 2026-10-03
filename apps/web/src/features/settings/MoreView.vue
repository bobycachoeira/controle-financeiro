<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";
import { Moon, Sun } from "lucide-vue-next";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTheme } from "@/composables/useTheme";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";

const session = useSessionStore();
const sync = useSyncStore();
const router = useRouter();
const toast = useToast();
const { theme, setTheme } = useTheme();

const links = [
  { name: "transfers", label: "Transferências" },
  { name: "bills", label: "Contas a pagar/receber" },
  { name: "recurrences", label: "Recorrências" },
  { name: "budgets", label: "Orçamentos" },
  { name: "import", label: "Importar extrato" },
  { name: "currencies", label: "Moedas e cotações" },
  { name: "integrations", label: "Integrações" },
  { name: "people", label: "Pessoas" },
  { name: "categories", label: "Categorias" },
  { name: "invites", label: "Família e convites" },
  { name: "notifications", label: "Notificações" },
  { name: "devices", label: "Segurança e dispositivos" },
  { name: "passkeys", label: "Passkeys" },
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
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Ajustes</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Mais</h1>
    </div>

    <Card>
      <CardContent class="space-y-3 p-4">
        <p class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Aparência</p>
        <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
            :class="theme === 'light' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="setTheme('light')"
          >
            <Sun class="h-4 w-4" /> Claro
          </button>
          <button
            type="button"
            class="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
            :class="theme === 'dark' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="setTheme('dark')"
          >
            <Moon class="h-4 w-4" /> Escuro
          </button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="divide-y p-0">
        <RouterLink
          v-for="link in links"
          :key="link.name"
          :to="{ name: link.name }"
          class="flex items-center justify-between px-4 py-3 text-sm font-bold transition hover:bg-muted"
        >
          {{ link.label }}
          <span class="text-muted-foreground">›</span>
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
