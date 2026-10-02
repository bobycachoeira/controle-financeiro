<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { todayISO } from "@cf/shared";
import { useTransfersStore } from "@/stores/transfers";
import { useAccountsStore } from "@/stores/accounts";
import { useToast } from "@/composables/useToast";
import { parseAmountInput, formatBRL } from "@/lib/format-input";
import { formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const transfersStore = useTransfersStore();
const accountsStore = useAccountsStore();
const toast = useToast();

const source = ref("");
const destination = ref("");
const amount = ref("");
const date = ref(todayISO());
const description = ref("");
const saving = ref(false);

const accountById = computed(() => new Map(accountsStore.items.map((item) => [item.id, item.name])));

async function submit(): Promise<void> {
  const cents = parseAmountInput(amount.value);
  if (cents === null || cents <= 0) {
    toast.error("Valor inválido.");
    return;
  }
  saving.value = true;
  try {
    await transfersStore.create({
      source_account: source.value,
      destination_account: destination.value,
      amount_cents: cents,
      date: date.value,
      description: description.value || "Transferência",
    });
    toast.success("Transferência registrada.");
    amount.value = "";
    description.value = "";
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha na transferência.");
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await Promise.all([accountsStore.load(), transfersStore.load()]);
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Transferências</h1>

    <Card>
      <CardHeader><CardTitle>Nova transferência</CardTitle></CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="source">Conta de origem</Label>
            <Select id="source" v-model="source" required>
              <option value="">Selecione</option>
              <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="destination">Conta de destino</Label>
            <Select id="destination" v-model="destination" required>
              <option value="">Selecione</option>
              <option v-for="item in accountsStore.items" :key="item.id" :value="item.id">
                {{ item.name }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="transfer-amount">Valor (R$)</Label>
            <Input id="transfer-amount" v-model="amount" inputmode="decimal" placeholder="0,00" />
          </div>
          <div class="space-y-2">
            <Label for="transfer-date">Data</Label>
            <Input id="transfer-date" v-model="date" type="date" />
          </div>
          <div class="space-y-2">
            <Label for="transfer-description">Descrição</Label>
            <Input id="transfer-description" v-model="description" maxlength="200" />
          </div>
          <Button type="submit" :loading="saving">Transferir</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Histórico</CardTitle></CardHeader>
      <CardContent>
        <p v-if="transfersStore.items.length === 0" class="text-sm text-muted-foreground">
          Nenhuma transferência.
        </p>
        <ul v-else class="divide-y">
          <li
            v-for="transfer in transfersStore.items"
            :key="transfer.id"
            class="flex items-center justify-between py-2 text-sm"
          >
            <div>
              <p class="font-medium">{{ transfer.description }}</p>
              <p class="text-xs text-muted-foreground">
                {{ accountById.get(transfer.source_account) }} → {{ accountById.get(transfer.destination_account) }}
                · {{ formatDate(transfer.date) }}
              </p>
            </div>
            <span class="font-semibold">{{ formatBRL(transfer.amount_cents) }}</span>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
