<script setup lang="ts">
import { conflictDiff, type ConflictEntry } from "@/sync/conflict";
import { useSyncStore } from "@/stores/sync";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardContent from "@/components/ui/CardContent.vue";

const sync = useSyncStore();

const ENTITY_LABELS: Record<string, string> = {
  bills: "Conta a pagar/receber",
  transactions: "Lançamento",
  accounts: "Conta",
  credit_cards: "Cartão",
  invoices: "Fatura",
  transfers: "Transferência",
  categories: "Categoria",
  budgets: "Orçamento",
  recurrences: "Recorrência",
  installments: "Parcela",
  exchange_rates: "Cotação",
  households: "Família",
  household_members: "Membro",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  name: "Nome",
  amount_cents: "Valor",
  limit_cents: "Limite",
  initial_balance_cents: "Saldo inicial",
  due_date: "Vencimento",
  emission_date: "Emissão",
  date: "Data",
  closing_date: "Fechamento",
  status: "Status",
  type: "Tipo",
  nature: "Natureza",
  description: "Descrição",
  category: "Categoria",
  attribution: "Atribuição",
  owner: "Titular",
  confirmed_at: "Confirmado em",
  closing_day: "Dia de fechamento",
  due_day: "Dia de vencimento",
  periodicity: "Periodicidade",
  recurrence: "Recorrência",
  include_in_total: "Inclui no total",
  active: "Ativo",
  kind: "Tipo",
  group: "Grupo",
};

function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity;
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function display(field: string, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  if (field.endsWith("_cents")) return formatBRL(Number(value));
  if (typeof value === "boolean") return value ? "sim" : "não";
  if (field.endsWith("_date")) return formatDate(String(value).slice(0, 10));
  if (field.endsWith("_at")) return formatDateTime(String(value));
  return String(value);
}

function diffsFor(entry: ConflictEntry) {
  return conflictDiff(entry);
}
</script>

<template>
  <Card v-if="sync.conflicts.length > 0" class="border-amber-300">
    <CardHeader>
      <CardTitle>Itens alterados em dois lugares</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <p class="text-sm text-muted-foreground">
        O mesmo item foi alterado aqui e em outro aparelho (ou pelo seu par). Revise a diferença e
        escolha qual versão manter — sem certeza, mantenha a já sincronizada.
      </p>
      <div
        v-for="conflict in sync.conflicts"
        :key="`${conflict.entity}-${conflict.id}`"
        class="space-y-2 rounded-2xl border p-3 text-sm"
      >
        <div class="flex items-center justify-between gap-2">
          <p class="font-medium">{{ entityLabel(conflict.entity) }}</p>
          <span
            class="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-wider text-muted-foreground"
          >
            revisar
          </span>
        </div>

        <ul v-if="diffsFor(conflict).length > 0" class="space-y-1">
          <li v-for="diff in diffsFor(conflict)" :key="diff.field" class="text-xs">
            <span class="font-bold">{{ fieldLabel(diff.field) }}:</span>
            <span class="text-muted-foreground line-through">{{ display(diff.field, diff.client) }}</span>
            <span class="px-1">→</span>
            <span class="font-semibold">{{ display(diff.field, diff.server) }}</span>
          </li>
        </ul>
        <p v-else class="text-xs text-muted-foreground">
          Nenhuma diferença visível — pode manter qualquer uma das versões.
        </p>

        <p class="text-[0.65rem] text-muted-foreground">
          Versão sincronizada em {{ formatDateTime(conflict.serverRecord.updated ?? "") }}
        </p>

        <div class="flex flex-wrap gap-2 pt-1">
          <Button size="sm" @click="sync.keepServer(conflict.id)">Usar a já sincronizada</Button>
          <Button size="sm" variant="outline" @click="sync.reapplyClient(conflict.id)">
            Manter minha edição
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
