<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BillNature, BillType } from "@cf/shared";
import { computeBillsTotals, todayISO } from "@cf/shared";
import { db, type LocalBill } from "@/db/schema";
import { createLocal, newSyncId, newLocalId, updateLocal } from "@/db/repositories";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { parseAmountInput, formatBRL } from "@/lib/format-input";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const bills = ref<LocalBill[]>([]);
const title = ref("");
const amount = ref("");
const nature = ref<BillNature>("saida");
const type = ref<BillType>("fixa");
const dueDate = ref(todayISO());
const saving = ref(false);

const month = ref(todayISO().slice(0, 7));
const totals = computed(() => computeBillsTotals(bills.value, month.value));

async function load(): Promise<void> {
  if (!session.currentHouseholdId) return;
  bills.value = (
    await db.bills.where("household").equals(session.currentHouseholdId).toArray()
  )
    .filter((bill) => !bill.deleted_at)
    .sort((a, b) => (a.due_date < b.due_date ? 1 : -1));
}

async function create(): Promise<void> {
  const cents = parseAmountInput(amount.value);
  if (!title.value || cents === null || cents <= 0) {
    toast.error("Preencha título e valor.");
    return;
  }
  saving.value = true;
  try {
    await createLocal("bills", {
      id: newLocalId(),
      household: session.currentHouseholdId ?? "",
      sync_id: newSyncId(),
      title: title.value,
      amount_cents: cents,
      currency: "BRL",
      type: type.value,
      nature: nature.value,
      due_date: dueDate.value,
      periodicity: "unica",
      status: "pendente",
      attribution: "ambos",
      responsible_user: null,
      category: null,
      recurrence: null,
      reminder_config: {},
      last_generation: null,
      next_generation: null,
      updated_by: session.user?.id ?? null,
      deleted_at: null,
    });
    toast.success("Conta adicionada.");
    title.value = "";
    amount.value = "";
    await load();
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

async function setStatus(bill: LocalBill, status: LocalBill["status"]): Promise<void> {
  await updateLocal("bills", { ...bill, status });
  await load();
}

onMounted(load);
watch(() => sync.dataVersion, load);
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Contas a pagar e receber</h1>

    <div class="grid grid-cols-2 gap-4">
      <Card>
        <CardContent class="p-4">
          <p class="text-xs text-muted-foreground">A pagar ({{ month }})</p>
          <p class="mt-1 text-lg font-semibold">{{ formatBRL(totals.pendenteCents) }}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-4">
          <p class="text-xs text-muted-foreground">Pago ({{ month }})</p>
          <p class="mt-1 text-lg font-semibold">{{ formatBRL(totals.pagoCents) }}</p>
        </CardContent>
      </Card>
    </div>

    <Card>
      <CardHeader><CardTitle>Nova conta</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="create">
          <div class="space-y-2">
            <Label for="bill-title">Título</Label>
            <Input id="bill-title" v-model="title" required maxlength="120" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="bill-amount">Valor (R$)</Label>
              <Input id="bill-amount" v-model="amount" inputmode="decimal" placeholder="0,00" />
            </div>
            <div class="space-y-2">
              <Label for="bill-due">Vencimento</Label>
              <Input id="bill-due" v-model="dueDate" type="date" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-2">
              <Label for="bill-nature">Tipo</Label>
              <Select id="bill-nature" v-model="nature">
                <option value="saida">A pagar</option>
                <option value="entrada">A receber</option>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="bill-type">Recorrência</Label>
              <Select id="bill-type" v-model="type">
                <option value="fixa">Fixa</option>
                <option value="variavel">Variável</option>
              </Select>
            </div>
          </div>
          <Button type="submit" :loading="saving">Adicionar</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Contas</CardTitle>
      </CardHeader>
      <CardContent>
        <p v-if="bills.length === 0" class="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        <ul v-else class="divide-y">
          <li
            v-for="bill in bills"
            :key="bill.id"
            class="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p class="font-medium">{{ bill.title }}</p>
              <p class="text-xs text-muted-foreground">
                {{ bill.type }} · vence {{ formatDate(bill.due_date) }} · {{ formatBRL(bill.amount_cents) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge
                :variant="bill.status === 'pago' ? 'success' : bill.status === 'cancelado' ? 'destructive' : 'warning'"
              >
                {{ bill.status }}
              </Badge>
              <Button
                v-if="bill.status === 'pendente'"
                size="sm"
                variant="outline"
                @click="setStatus(bill, 'pago')"
              >
                Pagar
              </Button>
              <Button v-else size="sm" variant="ghost" @click="setStatus(bill, 'pendente')">
                Reabrir
              </Button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
