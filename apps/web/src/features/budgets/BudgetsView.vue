<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BudgetUsage, BudgetPeriod } from "@cf/shared";
import { monthLabel, todayISO } from "@cf/shared";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import { db, type LocalCategory } from "@/db/schema";
import { useBudgetsStore } from "@/stores/budgets";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { parseAmountInput, formatBRL } from "@/lib/format-input";
import { formatCentsToInput } from "@/lib/format";
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
const history = ref<Record<string, { month: string; usage: BudgetUsage }[]>>({});
const editingId = ref<string | null>(null);
const name = ref("");
const period = ref<BudgetPeriod>("mensal");
const total = ref("");
const alertPct = ref(80);
const referenceMonth = ref(todayISO().slice(0, 7));
const selectedCategories = ref<string[]>([]);
const categories = ref<LocalCategory[]>([]);
const categoryFilter = ref("");
const saving = ref(false);

const filteredCategories = computed(() => {
  const term = categoryFilter.value.trim().toLowerCase();
  if (!term) return categories.value;
  return categories.value.filter(
    (item) => item.name.toLowerCase().includes(term) || item.group.toLowerCase().includes(term),
  );
});

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
  const periods: Record<string, { month: string; usage: BudgetUsage }[]> = {};
  for (const budget of store.items) {
    result[budget.id] = await store.usageFor(budget);
    periods[budget.id] = await store.historyFor(budget);
  }
  usage.value = result;
  history.value = periods;
}

function resetForm(): void {
  editingId.value = null;
  name.value = "";
  total.value = "";
  alertPct.value = 80;
  referenceMonth.value = todayISO().slice(0, 7);
  period.value = "mensal";
  selectedCategories.value = [];
}

function openEdit(budget: (typeof store.items)[number]): void {
  editingId.value = budget.id;
  name.value = budget.name;
  period.value = budget.period;
  total.value = formatCentsToInput(budget.total_cents);
  alertPct.value = budget.alert_pct;
  referenceMonth.value = budget.reference_month;
  selectedCategories.value = budget.categories.map((item) => item.category);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(total.value);
  if (!name.value || cents === null || cents <= 0 || selectedCategories.value.length === 0) {
    toast.error("Informe nome, valor e ao menos uma categoria.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: name.value,
      period: period.value,
      total_cents: cents,
      alert_pct: Number(alertPct.value),
      reference_month: referenceMonth.value,
      categories: selectedCategories.value.map((category) => ({ category })),
    };
    if (editingId.value) {
      await store.update(editingId.value, payload);
      toast.success("Orçamento atualizado.");
    } else {
      await store.create(payload);
      toast.success("Orçamento criado.");
    }
    resetForm();
    await refreshUsage();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
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
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Planejamento</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Orçamentos</h1>
      </div>
      <Button size="sm" variant="secondary" @click="resetForm"><Plus class="h-4 w-4" /> Novo</Button>
    </div>

    <Card>
      <CardHeader><CardTitle>{{ editingId ? "Editar orçamento" : "Novo orçamento" }}</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
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
            <Input v-model="categoryFilter" placeholder="Filtrar categoria…" />
            <div class="flex flex-wrap gap-2">
              <label
                v-for="item in filteredCategories"
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
              <p v-if="filteredCategories.length === 0" class="text-xs text-muted-foreground">
                Nenhuma categoria encontrada.
              </p>
            </div>
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <Button v-if="editingId" variant="ghost" type="button" @click="resetForm">Cancelar</Button>
            <Button type="submit" :loading="saving">
              {{ editingId ? "Salvar alterações" : "Criar orçamento" }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card v-for="budget in store.items" :key="budget.id">
      <CardHeader>
        <div class="flex items-center justify-between gap-2">
          <CardTitle>{{ budget.name }}</CardTitle>
          <span class="flex items-center gap-2">
            <Badge :variant="statusVariant[usage[budget.id]?.status ?? 'ok']">
              {{ statusLabel[usage[budget.id]?.status ?? "ok"] }}
            </Badge>
            <button
              class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
              aria-label="Editar orçamento"
              @click="openEdit(budget)"
            >
              <Pencil class="h-3.5 w-3.5" />
            </button>
            <button
              class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
              aria-label="Excluir orçamento"
              @click="store.remove(budget.id); refreshUsage()"
            >
              <Trash2 class="h-3.5 w-3.5" />
            </button>
          </span>
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

        <div class="border-t border-border/60 pt-3">
          <p class="pb-2 text-[0.62rem] font-extrabold uppercase tracking-wider text-muted-foreground">
            Histórico
          </p>
          <div class="flex items-end gap-1.5">
            <div
              v-for="entry in history[budget.id] ?? []"
              :key="entry.month"
              class="flex min-w-0 flex-1 flex-col items-center gap-1"
              :title="`${entry.month}: ${formatBRL(entry.usage.spentCents)} de ${formatBRL(budget.total_cents)}`"
            >
              <div class="flex h-14 w-full items-end overflow-hidden rounded-md bg-muted/60">
                <div
                  class="w-full rounded-md transition-all"
                  :class="
                    entry.usage.status === 'estouro'
                      ? 'bg-red-500'
                      : entry.usage.status === 'alerta'
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                  "
                  :style="{ height: Math.min(100, entry.usage.percent) + '%' }"
                />
              </div>
              <span class="truncate text-[0.55rem] font-bold uppercase text-muted-foreground">
                {{ monthLabel(entry.month) }}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
