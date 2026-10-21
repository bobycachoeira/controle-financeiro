<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { auditApi, type AuditRecord } from "@/api/audit-api";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Badge from "@/components/ui/Badge.vue";

const session = useSessionStore();
const toast = useToast();

const items = ref<AuditRecord[]>([]);
const total = ref(0);
const page = ref(1);
const perPage = 30;
const loading = ref(false);
const error = ref<string | null>(null);

const filterAction = ref("");
const filterEntity = ref("");
const filterUser = ref("");
const filterFrom = ref("");
const filterTo = ref("");

const ENTITY_OPTIONS = [
  { value: "", label: "Todas as entidades" },
  { value: "bills", label: "Contas" },
  { value: "transactions", label: "Lançamentos" },
  { value: "accounts", label: "Contas bancárias" },
  { value: "credit_cards", label: "Cartões" },
  { value: "invoices", label: "Faturas" },
  { value: "transfers", label: "Transferências" },
  { value: "categories", label: "Categorias" },
  { value: "budgets", label: "Orçamentos" },
  { value: "recurrences", label: "Recorrências" },
  { value: "household_members", label: "Membros" },
  { value: "households", label: "Família" },
  { value: "users", label: "Usuários" },
];

const ACTION_LABELS: Record<string, string> = {
  "conflict.keep_server": "Conflito: manteve do servidor",
  "conflict.reapply_client": "Conflito: reaplicou minha versão",
  "invite.create": "Convite criado",
  "invite.accept": "Convite aceito",
  "member.approve": "Membro aprovado",
  "member.reject": "Solicitação recusada",
  "member.role.update": "Papel alterado",
  "member.remove": "Membro removido",
  "household.create": "Família criada",
  "profile.update": "Perfil atualizado",
  "2fa.enabled": "2FA ativado",
  "2fa.disabled": "2FA desativado",
  "2fa.verified": "2FA verificado",
  "auth.login": "Login",
  "auth.logout": "Logout",
  "auth.magic_link.request": "Magic link solicitado",
};

const ENTITY_LABELS: Record<string, string> = {
  bills: "Conta",
  transactions: "Lançamento",
  accounts: "Conta bancária",
  credit_cards: "Cartão",
  invoices: "Fatura",
  transfers: "Transferência",
  categories: "Categoria",
  budgets: "Orçamento",
  recurrences: "Recorrência",
  household_members: "Membro",
  households: "Família",
  users: "Usuário",
};

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  name: "Nome",
  amount_cents: "Valor",
  limit_cents: "Limite",
  due_date: "Vencimento",
  emission_date: "Emissão",
  status: "Status",
  type: "Tipo",
  nature: "Natureza",
  merchant: "Estabelecimento",
  description: "Descrição",
  category: "Categoria",
  attribution: "Atribuição",
  role: "Papel",
  email: "E-mail",
  email_invited: "E-mail convidado",
};

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / perPage)));

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

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
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface Change {
  field: string;
  from: unknown;
  to: unknown;
}

function changes(record: AuditRecord): Change[] {
  const before = record.before ?? {};
  const after = record.after ?? {};
  const clientServer = Object.entries(before).every(
    (entry) => entry[1] && typeof entry[1] === "object" && "client" in (entry[1] as object),
  );
  if (record.action.startsWith("conflict.") && clientServer) {
    return Object.entries(before).map(([field, value]) => {
      const pair = value as { client?: unknown; server?: unknown };
      return { field, from: pair.client, to: pair.server };
    });
  }
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out: Change[] = [];
  for (const field of keys) {
    if (JSON.stringify(before[field] ?? null) === JSON.stringify(after[field] ?? null)) continue;
    out.push({ field, from: before[field], to: after[field] });
  }
  return out;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const result = await auditApi.list({
      household: session.currentHouseholdId ?? undefined,
      page: page.value,
      perPage,
      action: filterAction.value.trim() || undefined,
      entity: filterEntity.value || undefined,
      user: filterUser.value || undefined,
      from: filterFrom.value || undefined,
      to: filterTo.value || undefined,
    });
    items.value = result.items;
    total.value = result.total;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Falha ao carregar a auditoria.";
    items.value = [];
    total.value = 0;
    toast.error(error.value);
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  page.value = 1;
  void load();
}

function goTo(next: number): void {
  page.value = Math.min(Math.max(1, next), totalPages.value);
  void load();
}

onMounted(load);
watch(() => session.currentHouseholdId, load);
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Administração</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Auditoria</h1>
      <p class="text-sm text-muted-foreground">Histórico de ações e alterações da família.</p>
    </div>

    <Card>
      <CardContent class="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        <div class="space-y-1">
          <Label for="audit-action">Ação</Label>
          <Input id="audit-action" v-model="filterAction" placeholder="ex.: conflito, convite" />
        </div>
        <div class="space-y-1">
          <Label for="audit-entity">Entidade</Label>
          <Select id="audit-entity" v-model="filterEntity">
            <option v-for="option in ENTITY_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-1">
          <Label for="audit-user">Pessoa</Label>
          <Select id="audit-user" v-model="filterUser">
            <option value="">Todas</option>
            <option v-for="member in session.members" :key="member.user" :value="member.user">
              {{ member.user_name || member.user }}
            </option>
          </Select>
        </div>
        <div class="space-y-1">
          <Label for="audit-from">De</Label>
          <Input id="audit-from" v-model="filterFrom" type="date" />
        </div>
        <div class="space-y-1">
          <Label for="audit-to">Até</Label>
          <Input id="audit-to" v-model="filterTo" type="date" />
        </div>
        <div class="flex items-end">
          <Button class="w-full" :loading="loading" @click="applyFilters">Aplicar filtros</Button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardContent class="space-y-3 p-4">
        <p v-if="loading" class="py-6 text-center text-sm text-muted-foreground">Carregando…</p>
        <p v-else-if="error" class="py-6 text-center text-sm text-destructive">{{ error }}</p>
        <p v-else-if="items.length === 0" class="py-6 text-center text-sm text-muted-foreground">
          Nenhum registro encontrado.
        </p>
        <ul v-else class="divide-y">
          <li v-for="record in items" :key="record.id" class="space-y-1.5 py-3 text-sm">
            <div class="flex flex-wrap items-center gap-2">
              <span class="font-bold">{{ actionLabel(record.action) }}</span>
              <Badge v-if="record.entity" variant="secondary">{{ entityLabel(record.entity) }}</Badge>
              <span class="text-xs text-muted-foreground">
                {{ record.user_name || record.user || "sistema" }} · {{ formatDateTime(record.created) }}
              </span>
            </div>
            <ul v-if="changes(record).length > 0" class="space-y-0.5 pl-1 text-xs">
              <li v-for="change in changes(record)" :key="change.field">
                <span class="font-bold">{{ fieldLabel(change.field) }}:</span>
                <span class="text-muted-foreground line-through">{{ display(change.field, change.from) }}</span>
                <span class="px-1">→</span>
                <span class="font-semibold">{{ display(change.field, change.to) }}</span>
              </li>
            </ul>
          </li>
        </ul>

        <div v-if="!loading && !error && total > perPage" class="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" :disabled="page <= 1" @click="goTo(page - 1)">
            Anterior
          </Button>
          <span class="text-xs text-muted-foreground">Página {{ page }} de {{ totalPages }} · {{ total }} registros</span>
          <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="goTo(page + 1)">
            Próxima
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
