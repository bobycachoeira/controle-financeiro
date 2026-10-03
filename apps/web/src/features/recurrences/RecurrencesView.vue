<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { todayISO } from "@cf/shared";
import { Pencil, Plus, Trash2 } from "lucide-vue-next";
import { db, type LocalCategory } from "@/db/schema";
import { useRecurrencesStore } from "@/stores/recurrences";
import { useAccountsStore } from "@/stores/accounts";
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

const store = useRecurrencesStore();
const accountsStore = useAccountsStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const editingId = ref<string | null>(null);
const name = ref("");
const rrule = ref("FREQ=MONTHLY;INTERVAL=1");
const startDate = ref(todayISO());
const target = ref<"transaction" | "bill">("transaction");
const createsStatus = ref<"pago" | "a_pagar">("a_pagar");
const amount = ref("");
const account = ref("");
const category = ref("");
const nature = ref<"entrada" | "saida">("saida");
const saving = ref(false);
const categories = ref<LocalCategory[]>([]);

async function loadCategories(): Promise<void> {
  if (!session.currentHouseholdId) return;
  categories.value = (
    await db.categories.where("household").equals(session.currentHouseholdId).toArray()
  ).filter((item) => !item.deleted_at);
}

function resetForm(): void {
  editingId.value = null;
  name.value = "";
  amount.value = "";
  rrule.value = "FREQ=MONTHLY;INTERVAL=1";
  startDate.value = todayISO();
  target.value = "transaction";
  createsStatus.value = "a_pagar";
  account.value = "";
  category.value = "";
  nature.value = "saida";
}

function openEdit(item: (typeof store.items)[number]): void {
  editingId.value = item.id;
  name.value = item.name;
  rrule.value = item.rrule;
  startDate.value = item.start_date.slice(0, 10);
  target.value = item.target;
  createsStatus.value = item.creates_status;
  amount.value = formatCentsToInput(item.template.amount_cents);
  account.value = item.template.account ?? "";
  category.value = item.template.category ?? "";
  nature.value = item.template.nature ?? (item.template.type === "receita" ? "entrada" : "saida");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(amount.value);
  if (!name.value || cents === null || cents <= 0) {
    toast.error("Informe nome e valor.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: name.value,
      rrule: rrule.value,
      start_date: startDate.value,
      target: target.value,
      creates_status: createsStatus.value,
      template: {
        amount_cents: cents,
        type: (nature.value === "entrada" ? "receita" : "despesa") as "receita" | "despesa",
        account: account.value || null,
        category: category.value || null,
        attribution: "ambos" as const,
        nature: nature.value,
        description: name.value,
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
  await Promise.all([accountsStore.load(), loadCategories(), store.load()]);
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
            <Label for="rec-rrule">Regra (RRULE)</Label>
            <Input id="rec-rrule" v-model="rrule" required />
            <p class="text-xs text-muted-foreground">
              Ex.: FREQ=MONTHLY;INTERVAL=1 · FREQ=WEEKLY;BYDAY=MO · FREQ=YEARLY;COUNT=3
            </p>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-start">Início</Label>
              <Input id="rec-start" v-model="startDate" type="date" />
            </div>
            <div class="space-y-2">
              <Label for="rec-amount">Valor (R$)</Label>
              <Input id="rec-amount" v-model="amount" inputmode="decimal" placeholder="0,00" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="rec-target">Gera</Label>
              <Select id="rec-target" v-model="target">
                <option value="transaction">Lançamento</option>
                <option value="bill">Conta a pagar/receber</option>
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
          <div class="space-y-2">
            <Label for="rec-category">Categoria</Label>
            <Select id="rec-category" v-model="category">
              <option value="">Selecione</option>
              <option v-for="item in categories" :key="item.id" :value="item.id">
                {{ item.group }} · {{ item.name }}
              </option>
            </Select>
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
                {{ item.rrule }} · {{ formatBRL(item.template.amount_cents) }}
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
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
                aria-label="Editar recorrência"
                @click="openEdit(item)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
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
