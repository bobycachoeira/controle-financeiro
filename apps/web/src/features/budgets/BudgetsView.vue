<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BudgetUsage, BudgetPeriod } from "@cf/shared";
import { todayISO } from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { useBudgetsStore } from "@/stores/budgets";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { parseAmountInput, formatBRL } from "@/lib/format-input";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const store = useBudgetsStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const usage = ref<Record<string, BudgetUsage>>({});
const name = ref("");
const period = ref<BudgetPeriod>("mensal");
const total = ref("");
const alertPct = ref(80);
const referenceMonth = ref(todayISO().slice(0, 7));
const selectedCategories = ref<string[]>([]);
const categories = ref<LocalCategory[]>([]);
const saving = ref(false);

const statusVariant: Record<string, "success" | "warning" | "destructive"> = {
  ok: "success",
  alerta: "warning",
  estouro: "destructive",
};
const statusLabel: Record<string, string> = {
  ok: "Dentro do orçamento",
  alerta: "Atenção",
  estouro: "Estourado",
};

const categoryById = computed(() => new Map(categories.value.map((item) => [item.id, item])));

function toggleCategory(id: string): void {
  const index = selectedCategories.value.indexOf(id);
  if (index >= 0) selectedCategories.value.splice(index, 1);
  else selectedCategories.value.push(id);
}

async function refreshUsage(): Promise<void> {
  const result: Record<string, BudgetUsage> = {};
  for (const budget of store.items) {
    result[budget.id] = await store.usageFor(budget);
  }
  usage.value = result;
}

async function create(): Promise<void> {
  const cents = parseAmountInput(total.value);
  if (!name.value || cents === null || cents <= 0 || selectedCategories.value.length === 0) {
    toast.error("Informe nome, valor e ao menos uma categoria.");
    return;
  }
  saving.value = true;
  try {
    await store.create({
      name: name.value,
      period: period.value,
      total_cents: cents,
      alert_pct: Number(alertPct.value),
      reference_month: referenceMonth.value,
      categories: selectedCategories.value.map((category) => ({ category })),
    });
    toast.success("Orçamento criado.");
    name.value = "";
    total.value = "";
    selectedCategories.value = [];
    await refreshUsage();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar.");
  } finally {
    saving.value = false;
  }
}

async function loadAll(): Promise<void> {
  if (session.currentHouseholdId) {
    categories.value = (
      await db.categories.where("household").equals(session.currentHouseholdId).toArray()
    ).filter((item) => !item.deleted_at);
  }
  await store.load();
  await refreshUsage();
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Orçamentos</h1>

    <Card>
      <CardHeader><CardTitle>Novo orçamento</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="create">
          <div class="space-y-2">
            <Label for="budget-name">Nome</Label>
            <Input id="budget-name" v-model="name" required maxlength="80" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="budget-period">Período</Label>
              <Select id="budget-period" v-model="period">
                <option value="mensal">Mensal</option>
                <option value="trimestral">Trimestral</option>
                <option value="anual">Anual</option>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="budget-total">Limite (R$)</Label>
              <Input id="budget-total" v-model="total" inputmode="decimal" placeholder="0,00" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="budget-alert">Alerta (%)</Label>
              <Input id="budget-alert" v-model.number="alertPct" type="number" min="1" max="100" />
            </div>
            <div class="space-y-2">
              <Label for="budget-month">Mês de referência</Label>
              <Input id="budget-month" v-model="referenceMonth" type="month" />
            </div>
          </div>
          <div class="space-y-2">
            <Label>Categorias</Label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="item in categories"
                :key="item.id"
                class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  class="h-3 w-3"
                  :checked="selectedCategories.includes(item.id)"
                  @change="toggleCategory(item.id)"
                />
                {{ item.name }}
              </label>
            </div>
          </div>
          <Button type="submit" :loading="saving">Criar orçamento</Button>
        </form>
      </CardContent>
    </Card>

    <Card v-for="budget in store.items" :key="budget.id">
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>{{ budget.name }}</CardTitle>
          <Badge :variant="statusVariant[usage[budget.id]?.status ?? 'ok']">
            {{ statusLabel[usage[budget.id]?.status ?? "ok"] }}
          </Badge>
        </div>
      </CardHeader>
      <CardContent class="space-y-3">
        <p class="text-sm text-muted-foreground">
          {{ formatBRL(usage[budget.id]?.spentCents ?? 0) }} de
          {{ formatBRL(budget.total_cents) }} · {{ usage[budget.id]?.percent ?? 0 }}%
        </p>
        <div class="h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            class="h-full rounded-full"
            :class="
              usage[budget.id]?.status === 'estouro'
                ? 'bg-red-500'
                : usage[budget.id]?.status === 'alerta'
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
            "
            :style="{ width: Math.min(100, usage[budget.id]?.percent ?? 0) + '%' }"
          />
        </div>
        <ul class="space-y-1 text-xs text-muted-foreground">
          <li v-for="row in usage[budget.id]?.perCategory ?? []" :key="row.category">
            {{ categoryById.get(row.category)?.name ?? row.category }}:
            {{ formatBRL(row.spentCents) }}
          </li>
        </ul>
        <Button size="sm" variant="ghost" @click="store.remove(budget.id); refreshUsage()">
          Excluir
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
