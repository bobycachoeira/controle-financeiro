<script setup lang="ts">
import { computed, onMounted } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { CreditCard, LayoutDashboard, Menu, Receipt, Wallet } from "lucide-vue-next";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import SyncStatus from "@/features/sync/SyncStatus.vue";

const session = useSessionStore();
const sync = useSyncStore();
const route = useRoute();

const navItems = [
  { name: "dashboard", label: "Início", icon: LayoutDashboard },
  { name: "transactions", label: "Lançar", icon: Receipt },
  { name: "accounts", label: "Contas", icon: Wallet },
  { name: "cards", label: "Cartões", icon: CreditCard },
  { name: "more", label: "Mais", icon: Menu },
];

const householdName = computed(
  () => session.currentMembership?.household_name ?? "Minha família",
);
const initial = computed(() => (householdName.value.trim()[0] ?? "F").toUpperCase());

function isActive(name: string): boolean {
  const current = String(route.name ?? "");
  return current === name || current.startsWith(name);
}

onMounted(async () => {
  sync.bind();
  await sync.refreshStatus();
});
</script>

<template>
  <div class="relative z-[2] mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
    <header class="sticky top-0 z-40">
      <div
        class="flex items-center justify-between gap-3 border-b border-border/70 bg-background/80 px-4 py-3 backdrop-blur-lg"
      >
        <div class="flex min-w-0 items-center gap-3">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary font-display text-lg font-black text-primary-foreground shadow-lift"
          >
            {{ initial }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-display text-lg font-bold leading-tight">
              {{ householdName }}
            </p>
            <p class="truncate text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {{ session.currentRole ?? "familiar" }}
            </p>
          </div>
        </div>
        <SyncStatus />
      </div>
    </header>

    <main id="main-content" class="flex-1 px-4 pb-28 pt-5">
      <RouterView v-slot="{ Component }">
        <Transition
          mode="out-in"
          enter-active-class="transition duration-300 ease-out"
          enter-from-class="opacity-0 translate-y-2"
          leave-active-class="transition duration-150 ease-in"
          leave-to-class="opacity-0"
        >
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <nav
      class="fixed inset-x-0 bottom-3 z-40 mx-auto flex w-[calc(100%-1.5rem)] max-w-2xl items-stretch justify-between gap-1 rounded-[1.6rem] border border-border bg-card/90 p-1.5 shadow-lift backdrop-blur-lg"
      aria-label="Navegação principal"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex flex-1 flex-col items-center gap-0.5 rounded-[1.2rem] px-1 py-1.5 text-[0.66rem] font-extrabold uppercase tracking-wide transition-all duration-200"
        :class="
          isActive(item.name)
            ? 'bg-primary text-primary-foreground shadow-lift'
            : 'text-muted-foreground hover:bg-muted'
        "
      >
        <component :is="item.icon" class="h-5 w-5" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
