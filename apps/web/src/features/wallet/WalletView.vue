<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeftRight, CreditCard, Wallet } from "lucide-vue-next";
import Button from "@/components/ui/Button.vue";
import AccountsView from "@/features/accounts/AccountsView.vue";
import CardsView from "@/features/cards/CardsView.vue";

const router = useRouter();
const tab = ref<"contas" | "cartoes">("contas");
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Onde o dinheiro fica</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Carteira</h1>
      </div>
      <Button size="sm" variant="secondary" @click="router.push({ name: 'transfers' })">
        <ArrowLeftRight class="h-4 w-4" /> Transferir
      </Button>
    </div>

    <div class="grid grid-cols-2 gap-2 rounded-full bg-muted p-1">
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
        :class="tab === 'contas' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
        @click="tab = 'contas'"
      >
        <Wallet class="h-4 w-4" /> Contas
      </button>
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-extrabold transition"
        :class="tab === 'cartoes' ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground'"
        @click="tab = 'cartoes'"
      >
        <CreditCard class="h-4 w-4" /> Cartões
      </button>
    </div>

    <AccountsView v-if="tab === 'contas'" />
    <CardsView v-else />
  </div>
</template>
