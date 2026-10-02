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
  { name: "transactions", label: "Lançamentos", icon: Receipt },
  { name: "accounts", label: "Contas", icon: Wallet },
  { name: "cards", label: "Cartões", icon: CreditCard },
  { name: "more", label: "Mais", icon: Menu },
];

const householdName = computed(
  () => session.currentMembership?.household_name ?? "Minha família",
);

onMounted(async () => {
  sync.bind();
  await sync.refreshStatus();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col">
    <header class="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div class="flex items-center justify-between gap-3 px-4 py-3">
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold">{{ householdName }}</p>
          <p class="truncate text-xs text-muted-foreground">{{ session.currentRole ?? "" }}</p>
        </div>
        <SyncStatus />
      </div>
    </header>

    <main id="main-content" class="flex-1 px-4 pb-24 pt-4">
      <RouterView />
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl items-stretch justify-around border-t bg-background/95 backdrop-blur"
      aria-label="Navegação principal"
    >
      <RouterLink
        v-for="item in navItems"
        :key="item.name"
        :to="{ name: item.name }"
        class="flex flex-1 flex-col items-center gap-1 py-2 text-xs"
        :class="
          route.name === item.name || String(route.name).startsWith(item.name)
            ? 'text-primary'
            : 'text-muted-foreground'
        "
      >
        <component :is="item.icon" class="h-5 w-5" aria-hidden="true" />
        <span>{{ item.label }}</span>
      </RouterLink>
    </nav>
  </div>
</template>
