<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import { useRecurrencesStore } from "@/stores/recurrences";
import { useAccountsStore } from "@/stores/accounts";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { formatBRL } from "@/lib/format-input";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import CategorySelect from "@/components/ui/CategorySelect.vue";

const store = useRecurrencesStore();
const accountsStore = useAccountsStore();
const sync = useSyncStore();
const toast = useToast();

const FREQ_PRESETS = [
  { key: "diaria", label: "Diária", rrule: "FREQ=DAILY;INTERVAL=1" },
  { key: "semanal", label: "Semanal", rrule: "FREQ=WEEKLY;INTERVAL=1" },
  { key: "quinzenal", label: "Quinzenal", rrule: "FREQ=WEEKLY;INTERVAL=2" },
  { key: "mensal", label: "Mensal", rrule: "FREQ=MONTHLY;INTERVAL=1" },
  { key: "trimestral", label: "Trimestral", rrule: "FREQ=MONTHLY;INTERVAL=3" },
  { key: "semestral", label: "Semestral", rrule: "FREQ=MONTHLY;INTERVAL=6" },
  { key: "anual", label: "Anual", rrule: "FREQ=YEARLY;INTERVAL=1" },
] as const;

const editingId = ref<string | null>(null);
const name = ref("");
const frequency = ref("mensal");
const rrule = ref("FREQ=MONTHLY;INTERVAL=1");
const startDate = ref(todayISO());
const target = ref<"transaction" | "bill">("bill");
const createsStatus = ref<"pago" | "a_pagar">("a_pagar");
const amountCents = ref<number | null>(null);
const account = ref("");
const category = ref("");
const nature = ref<"entrada" | "saida">("saida");
const dueDay = ref("");
const confirmRequired = ref(false);
const saving = ref(false);

const isCustomFreq = computed(() => frequency.value === "custom");
const effectiveRrule = computed(() => {
  if (isCustomFreq.value) return rrule.value;
  return FREQ_PRESETS.find((preset) => preset.key === frequency.value)?.rrule ?? "FREQ=MONTHLY;INTERVAL=1";
});

function detectFrequency(value: string): string {
  const found = FREQ_PRESETS.find(
    (preset) => preset.rrule.toUpperCase() === value.trim().toUpperCase(),
  );
  return found ? found.key : "custom";
}

function frequencyLabel(value: string): string {
  const found = FREQ_PRESETS.find(
    (preset) => preset.rrule.toUpperCase() === value.trim().toUpperCase(),
  );
  return found ? found.label : value;
}

function resetForm(): void {
  editingId.value = null;
  name.value = "";
  amountCents.value = null;
  frequency.value = "mensal";
  rrule.value = "FREQ=MONTHLY;INTERVAL=1";
  startDate.value = todayISO();
  target.value = "bill";
  createsStatus.value = "a_pagar";
  account.value = "";
  category.value = "";
  nature.value = "saida";
  dueDay.value = "";
  confirmRequired.value = false;
}

function openEdit(item: (typeof store.items)[number]): void {
  editingId.value = item.id;
  name.value = item.name;
  frequency.value = detectFrequency(item.rrule);
  rrule.value = item.rrule;
  startDate.value = item.start_date.slice(0, 10);
  target.value = item.target;
  createsStatus.value = item.creates_status;
  amountCents.value = item.template.amount_cents || null;
  account.value = item.template.account ?? "";
  category.value = item.template.category ?? "";
  nature.value = item.template.nature ?? (item.template.type === "receita" ? "entrada" : "saida");
  dueDay.value = item.template.due_day ? String(item.template.due_day) : "";
  confirmRequired.value = Boolean(item.template.confirm_required);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submit(): Promise<void> {
  const cents = amountCents.value;
  const needsAmount = !(target.value === "bill" && confirmRequired.value);
  if (!name.value || cents === null || (needsAmount && cents <= 0)) {
    toast.error("Informe nome e valor.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: name.value,
      rrule: effectiveRrule.value,
      start_date: startDate.value,
      target: target.value,
      creates_status: createsStatus.value,
      template: {
        amount_cents: cents ?? 0,
        type: (nature.value === "entrada" ? "receita" : "despesa") as "receita" | "despesa",
        account: account.value || null,
        category: category.value || null,
        attribution: "ambos" as const,
        nature: nature.value,
        description: name.value,
        due_day: dueDay.value ? Number(dueDay.value) : null,
        confirm_required: target.value === "bill" ? confirmRequired.value : undefined,
      },
    };
    if (editingId.value) {
      await store.update(editingId.value, payload);
      toast.success("Recorrência atualizada.");
    } else {
      await store.create(payload);
      toast.success("Recorrência criada.");
    }
    resetForm();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

async function toggle(item: { id: string; active: boolean }): Promise<void> {
  await store.setActive(item.id, !item.active);
}

async function remove(id: string): Promise<void> {
  await store.remove(id);
  toast.info("Recorrência removida.");
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), store.load()]);
});
watch(() => sync.dataVersion, () => store.load());
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Automação</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Recorrências</h1>
      </div>
      <Button size="sm" variant="secondary" @click="resetForm"><Plus class="h-4 w-4" /> Nova</Button>
    </div>

    <Card>
      <CardHeader><CardTitle>{{ editingId ? "Editar recorrência" : "Nova recorrência" }}</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="rec-name">Nome</Label>
            <Input id="rec-name" v-model="name" required maxlength="80" />
          </div>
          <div class="space-y-2">
            <Label for="rec-freq">Frequência</Label>
            <Select id="rec-freq" v-model="frequency">
              <option v-for="preset in FREQ_PRESETS" :key="preset.key" :value="preset.key">
                {{ preset.label }}
              </option>
              <option value="custom">Personalizado…</option>
            </Select>
          </div>
          <div v-if="isCustomFreq" class="space-y-2">
            <Label for="rec-rrule">Regra personalizada (RRULE)</Label>
            <Input id="rec-rrule" v-model="rrule" placeholder="FREQ=MONTHLY;INTERVAL=1" />
            <p class="text-xs text-muted-foreground">
              Padrão RRULE (RFC 5545). Ex.: FREQ=WEEKLY;BYDAY=MO · FREQ=YEARLY;COUNT=3
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-start">Início</Label>
              <Input id="rec-start" v-model="startDate" type="date" />
            </div>
            <div class="space-y-2">
              <Label for="rec-amount">Valor (R$)</Label>
              <CurrencyInput id="rec-amount" v-model="amountCents" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-target">Gera</Label>
              <Select id="rec-target" v-model="target">
                <option value="bill">Conta a pagar/receber</option>
                <option value="transaction">Lançamento</option>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="rec-nature">Tipo</Label>
              <Select id="rec-nature" v-model="nature">
                <option value="saida">Saída</option>
                <option value="entrada">Entrada</option>
              </Select>
            </div>
          </div>
          <div v-if="target === 'transaction'" class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-account">Conta</Label>
              <Select id="rec-account" v-model="account">
                <option value="">Selecione</option>
                <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                  {{ item.name }}
                </option>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="rec-status">Status gerado</Label>
              <Select id="rec-status" v-model="createsStatus">
                <option value="a_pagar">A pagar</option>
                <option value="pago">Pago</option>
              </Select>
            </div>
          </div>
          <div v-if="target === 'bill'" class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-due-day">Dia do vencimento</Label>
              <Input
                id="rec-due-day"
                v-model="dueDay"
                inputmode="numeric"
                min="1"
                max="31"
                placeholder="Ex.: 10"
              />
            </div>
            <label class="flex items-end gap-2 pb-3 text-sm font-bold">
              <input v-model="confirmRequired" type="checkbox" class="h-5 w-5 rounded border-2 border-input" />
              Exige confirmação (a confirmar)
            </label>
          </div>
          <div class="space-y-2">
            <Label for="rec-category">Categoria</Label>
            <CategorySelect
              id="rec-category"
              v-model="category"
              :kind="nature === 'entrada' ? 'entrada' : 'saida'"
              allow-empty
            />
          </div>
          <div class="flex justify-end gap-2 pt-1">
            <Button v-if="editingId" variant="ghost" type="button" @click="resetForm">Cancelar</Button>
            <Button type="submit" :loading="saving">
              {{ editingId ? "Salvar alterações" : "Criar recorrência" }}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Minhas recorrências</CardTitle></CardHeader>
      <CardContent>
        <p v-if="store.items.length === 0" class="text-sm text-muted-foreground">
          Nenhuma recorrência ainda.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="item in store.items"
            :key="item.id"
            class="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p class="font-medium">{{ item.name }}</p>
              <p class="text-xs text-muted-foreground">
                {{ frequencyLabel(item.rrule) }} · {{ formatBRL(item.template.amount_cents) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge :variant="item.active ? 'success' : 'secondary'">
                {{ item.active ? "ativa" : "inativa" }}
              </Badge>
              <Button size="sm" variant="ghost" @click="toggle(item)">
                {{ item.active ? "Pausar" : "Ativar" }}
              </Button>
              <button
                class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
                aria-label="Editar recorrência"
                @click="openEdit(item)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-11 w-11 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
                aria-label="Excluir recorrência"
                @click="remove(item.id)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
