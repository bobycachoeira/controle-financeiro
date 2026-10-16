<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { Moon, Sun } from "lucide-vue-next";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTheme } from "@/composables/useTheme";
import { useToast } from "@/composables/useToast";
import { hapticsEnabled, setHapticsEnabled } from "@/lib/haptics";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";

const session = useSessionStore();
const sync = useSyncStore();
const router = useRouter();
const toast = useToast();
const { theme, setTheme } = useTheme();

const hapticsOn = ref(hapticsEnabled());

function toggleHaptics(): void {
  hapticsOn.value = !hapticsOn.value;
  setHapticsEnabled(hapticsOn.value);
}

interface MoreLink {
  name: string;
  label: string;
  ownerOnly?: boolean;
  permission?: string;
}

const groups: { title: string; links: MoreLink[] }[] = [
  {
    title: "Finanças",
    links: [
      { name: "review", label: "Revisar lançamentos" },
      { name: "transfers", label: "Transferências" },
      { name: "bills", label: "Contas a pagar/receber" },
      { name: "settle", label: "Acerto do mês" },
      { name: "recurrences", label: "Recorrências" },
      { name: "budgets", label: "Orçamentos" },
      { name: "goals", label: "Metas" },
      { name: "calendar", label: "Calendário" },
      { name: "closing", label: "Fechamento do mês" },
      { name: "investments", label: "Investimentos" },
      { name: "import", label: "Importar extrato" },
      { name: "currencies", label: "Moedas e cotações" },
      { name: "categories", label: "Categorias" },
    ],
  },
  {
    title: "Família",
    links: [
      { name: "family", label: "Família e convites" },
      { name: "notifications", label: "Notificações" },
    ],
  },
  {
    title: "Conta e segurança",
    links: [
      { name: "profile", label: "Perfil" },
      { name: "devices", label: "Segurança e dispositivos" },
      { name: "passkeys", label: "Passkeys" },
      { name: "app-lock", label: "App Lock" },
      { name: "audit", label: "Auditoria", ownerOnly: true, permission: "audit" },
    ],
  },
  {
    title: "Outros",
    links: [
      { name: "integrations", label: "Integrações" },
      { name: "export", label: "Exportar dados" },
    ],
  },
];

const visibleGroups = computed(() => {
  const canSee = (link: MoreLink): boolean => {
    if (!link.ownerOnly) return true;
    if (session.currentRole === "owner") return true;
    return Boolean(link.permission && session.currentMembership?.permissions?.[link.permission] === true);
  };
  return groups
    .map((group) => ({ title: group.title, links: group.links.filter(canSee) }))
    .filter((group) => group.links.length > 0);
});

const initial = computed(() => (session.user?.name ?? "?").trim().charAt(0).toUpperCase() || "?");

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

    <RouterLink :to="{ name: 'profile' }" class="block">
      <Card>
        <CardContent class="flex items-center gap-4 p-4">
          <div
            class="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xl font-black text-muted-foreground"
          >
            <img v-if="session.user?.avatar" :src="session.user.avatar" alt="" class="h-full w-full object-cover" />
            <span v-else>{{ initial }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate font-bold">{{ session.user?.name || "Meu perfil" }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ session.user?.email }}</p>
          </div>
          <span class="text-muted-foreground">›</span>
        </CardContent>
      </Card>
    </RouterLink>

    <Card>
      <CardContent class="space-y-3 p-4">
        <p class="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">Aparência</p>
        <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
          <button
            type="button"
            class="flex min-h-11 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
            :class="theme === 'light' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="setTheme('light')"
          >
            <Sun class="h-4 w-4" /> Claro
          </button>
          <button
            type="button"
            class="flex min-h-11 items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
            :class="theme === 'dark' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
            @click="setTheme('dark')"
          >
            <Moon class="h-4 w-4" /> Escuro
          </button>
        </div>
        <button
          type="button"
          role="switch"
          data-testid="haptics-toggle"
          :aria-checked="hapticsOn"
          class="flex min-h-11 w-full items-center justify-between gap-3 text-sm font-bold"
          @click="toggleHaptics"
        >
          Vibração ao salvar
          <span
            class="relative h-6 w-11 shrink-0 rounded-full transition"
            :class="hapticsOn ? 'bg-primary' : 'bg-muted-foreground/30'"
          >
            <span
              class="absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all"
              :class="hapticsOn ? 'left-[1.4rem]' : 'left-0.5'"
            />
          </span>
        </button>
      </CardContent>
    </Card>

    <div v-for="group in visibleGroups" :key="group.title" class="space-y-2">
      <p class="px-1 text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
        {{ group.title }}
      </p>
      <Card>
        <CardContent class="divide-y p-0">
          <RouterLink
            v-for="link in group.links"
            :key="link.name"
            :to="{ name: link.name }"
            class="flex items-center justify-between px-4 py-3 text-sm font-bold transition hover:bg-muted"
          >
            {{ link.label }}
            <span class="text-muted-foreground">›</span>
          </RouterLink>
        </CardContent>
      </Card>
    </div>

    <div class="flex flex-col gap-2">
      <Button variant="outline" :disabled="sync.syncing || !sync.online" @click="syncNow">
        Sincronizar agora
      </Button>
      <Button variant="ghost" @click="logout">Sair</Button>
    </div>
  </div>
</template>
