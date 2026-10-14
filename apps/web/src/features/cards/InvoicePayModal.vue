<script setup lang="ts">
import { ref } from "vue";
import { Banknote } from "lucide-vue-next";
import { applyInvoicePayment, todayISO } from "@cf/shared";
import { updateLocal } from "@/db/repositories";
import { useAccountsStore } from "@/stores/accounts";
import { useTransfersStore } from "@/stores/transfers";
import { useToast } from "@/composables/useToast";
import { formatBRL, parseAmountInput } from "@/lib/format-input";
import { formatCentsToInput, formatDate } from "@/lib/format";
import type { LocalCreditCard, LocalInvoice } from "@/db/schema";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Modal from "@/components/ui/Modal.vue";
import Select from "@/components/ui/Select.vue";

const emit = defineEmits<{ paid: [] }>();

const accountsStore = useAccountsStore();
const transfersStore = useTransfersStore();
const toast = useToast();

const open = ref(false);
const invoice = ref<LocalInvoice | null>(null);
const card = ref<LocalCreditCard | null>(null);
const payAccount = ref("");
const payAmount = ref("");
const paying = ref(false);

function openPay(cardInput: LocalCreditCard, invoiceInput: LocalInvoice): void {
  card.value = cardInput;
  invoice.value = invoiceInput;
  payAccount.value = cardInput.payment_account ?? "";
  const remaining = Math.max(0, invoiceInput.total_cents - (invoiceInput.paid_cents ?? 0));
  payAmount.value = remaining > 0 ? formatCentsToInput(remaining) : "";
  open.value = true;
}

async function confirmPay(): Promise<void> {
  const currentCard = card.value;
  const currentInvoice = invoice.value;
  if (!currentCard || !currentInvoice || !payAccount.value) {
    toast.error("Escolha a conta de pagamento.");
    return;
  }
  const cents = parseAmountInput(payAmount.value);
  if (cents === null || cents <= 0) {
    toast.error("Informe o valor da fatura.");
    return;
  }
  paying.value = true;
  try {
    await transfersStore.create({
      source_account: payAccount.value,
      destination_account: currentCard.account,
      amount_cents: cents,
      date: todayISO(),
      description: `Pagamento da fatura ${currentInvoice.reference_month}`,
    });
    // Acumula pagamentos parciais; não sobrescreve o total da fatura.
    const payment = applyInvoicePayment(currentInvoice, cents, new Date().toISOString());
    await updateLocal("invoices", { ...currentInvoice, ...payment });
    toast.success(
      payment.status === "paga"
        ? "Fatura paga e transferência registrada."
        : "Pagamento parcial registrado.",
    );
    open.value = false;
    emit("paid");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao pagar a fatura.");
  } finally {
    paying.value = false;
  }
}

defineExpose({ open: openPay });
</script>

<template>
  <Modal
    v-model="open"
    title="Pagar fatura"
    description="Registra uma transferência da conta escolhida para o cartão."
  >
    <form class="space-y-4" @submit.prevent="confirmPay">
      <div class="flex items-center gap-3 rounded-2xl bg-muted p-3">
        <Banknote class="h-5 w-5 text-primary" />
        <div>
          <p class="text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Fatura {{ invoice?.reference_month ?? "" }}
          </p>
          <p v-if="invoice" class="text-xs text-muted-foreground">
            Vence {{ formatDate(invoice.due_date) }} · Total {{ formatBRL(invoice.total_cents) }}
            <template v-if="(invoice.paid_cents ?? 0) > 0">
              · já pago {{ formatBRL(invoice.paid_cents) }}
            </template>
          </p>
        </div>
      </div>
      <div class="space-y-2">
        <Label for="pay-amount">Valor da fatura (R$)</Label>
        <Input id="pay-amount" v-model="payAmount" inputmode="decimal" placeholder="0,00" required />
      </div>
      <div class="space-y-2">
        <Label for="pay-account">Pagar com a conta</Label>
        <Select id="pay-account" v-model="payAccount" required>
          <option value="">Selecione</option>
          <option
            v-for="item in accountsStore.items.filter((account) => account.type !== 'cartao_credito')"
            :key="item.id"
            :value="item.id"
          >
            {{ item.name }}
          </option>
        </Select>
      </div>
      <div class="flex justify-end gap-2 pt-1">
        <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
        <Button type="submit" :loading="paying">Confirmar pagamento</Button>
      </div>
    </form>
  </Modal>
</template>
