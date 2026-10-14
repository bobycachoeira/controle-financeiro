<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { Minus, Pencil, PiggyBank, Plus, Target, Trash2 } from "lucide-vue-next";
import { goalProgress, todayISO } from "@cf/shared";
import type { LocalGoal } from "@/db/schema";
import { useGoalsStore } from "@/stores/goals";
import { usePeopleStore } from "@/stores/people";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { parseAmountInput } from "@/lib/format-input";
import { formatBRL, formatCentsToInput, formatDate } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";
import Modal from "@/components/ui/Modal.vue";

const GOAL_COLORS = ["#3F9A6A", "#3B82B6", "#8A6FD1", "#F2A93B", "#E4572E", "#B0477E"];

const goals = useGoalsStore();
const people = usePeopleStore();
const sync = useSyncStore();
const toast = useToast();

const open = ref(false);
const editingId = ref<string | null>(null);
const name = ref("");
const target = ref("");
const deadline = ref("");
const owner = ref("indefinido");
const color = ref(GOAL_COLORS[0]!);
const saving = ref(false);

const entryOpen = ref(false);
const entryGoal = ref<LocalGoal | null>(null);
const entryMode = ref<"guardar" | "resgatar">("guardar");
const entryAmount = ref("");
const entryNote = ref("");
const entryDate = ref(todayISO());
const entrySaving = ref(false);

const progressById = computed(() => {
  const map = new Map<string, ReturnType<typeof goalProgress>>();
  for (const goal of goals.items) {
    map.set(goal.id, goalProgress(goal.target_cents, goal.entries ?? []));
  }
  return map;
});

function historyOf(goal: LocalGoal) {
  return [...(goal.entries ?? [])].reverse().slice(0, 6);
}

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  target.value = "";
  deadline.value = "";
  owner.value = "indefinido";
  color.value = GOAL_COLORS[0]!;
  open.value = true;
}

function openEdit(goal: LocalGoal): void {
  editingId.value = goal.id;
  name.value = goal.name;
  target.value = formatCentsToInput(goal.target_cents);
  deadline.value = goal.deadline?.slice(0, 10) ?? "";
  owner.value = goal.owner ?? "indefinido";
  color.value = goal.color || GOAL_COLORS[0]!;
  open.value = true;
}

async function submit(): Promise<void> {
  const cents = parseAmountInput(target.value);
  if (!name.value || cents === null || cents <= 0) {
    toast.error("Informe nome e valor do objetivo.");
    return;
  }
  saving.value = true;
  try {
    const payload = {
      name: name.value,
      target_cents: cents,
      deadline: deadline.value || null,
      owner: owner.value,
      color: color.value,
    };
    if (editingId.value) {
      await goals.update(editingId.value, payload);
      toast.success("Meta atualizada.");
    } else {
      await goals.create(payload);
      toast.success("Meta criada.");
    }
    open.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

function openEntry(goal: LocalGoal, mode: "guardar" | "resgatar"): void {
  entryGoal.value = goal;
  entryMode.value = mode;
  entryAmount.value = "";
  entryNote.value = "";
  entryDate.value = todayISO();
  entryOpen.value = true;
}

async function submitEntry(): Promise<void> {
  const goal = entryGoal.value;
  const cents = parseAmountInput(entryAmount.value);
  if (!goal || cents === null || cents <= 0) {
    toast.error("Informe um valor válido.");
    return;
  }
  entrySaving.value = true;
  try {
    const signed = entryMode.value === "guardar" ? cents : -cents;
    await goals.addEntry(goal.id, signed, entryNote.value.trim(), entryDate.value);
    toast.success(entryMode.value === "guardar" ? "Valor guardado na meta." : "Resgate registrado.");
    entryOpen.value = false;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao registrar.");
  } finally {
    entrySaving.value = false;
  }
}

async function remove(goal: LocalGoal): Promise<void> {
  await goals.remove(goal.id);
  toast.info("Meta removida.");
}

async function loadAll(): Promise<void> {
  await Promise.all([goals.load(), people.load()]);
}

onMounted(loadAll);
watch(() => sync.dataVersion, loadAll);
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-end justify-between gap-3">
      <div>
        <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Sonhos</p>
        <h1 class="font-display text-3xl font-black tracking-tight">Metas</h1>
      </div>
      <Button size="sm" @click="openCreate"><Plus class="h-4 w-4" /> Nova</Button>
    </div>

    <p class="text-sm text-muted-foreground">
      Caixinhas compartilhadas: separe um valor do saldo para um objetivo — viagem, reserva, entrada.
      O dinheiro continua na conta; a meta só organiza.
    </p>

    <p
      v-if="goals.items.length === 0"
      class="flex flex-col items-center gap-2 rounded-[1.6rem] border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground"
    >
      <Target class="h-8 w-8 text-muted-foreground/50" />
      Nenhuma meta ainda. Crie a primeira.
    </p>

    <div class="stagger space-y-4">
      <Card v-for="goal in goals.items" :key="goal.id" data-testid="goal">
        <div class="h-1.5 w-full" :style="{ backgroundColor: goal.color || '#3F9A6A' }" />
        <CardContent class="space-y-3 p-4">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-display text-lg font-bold">{{ goal.name }}</p>
              <p class="text-xs font-semibold text-muted-foreground">
                <template v-if="goal.owner && goal.owner !== 'indefinido'">
                  {{ people.label(goal.owner) }} ·
                </template>
                <template v-if="goal.deadline">até {{ formatDate(goal.deadline) }} · </template>
                objetivo {{ formatBRL(goal.target_cents) }}
              </p>
            </div>
            <div class="flex shrink-0 gap-1">
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-primary"
                aria-label="Editar meta"
                @click="openEdit(goal)"
              >
                <Pencil class="h-3.5 w-3.5" />
              </button>
              <button
                class="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-destructive"
                aria-label="Excluir meta"
                @click="remove(goal)"
              >
                <Trash2 class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div>
            <div class="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                class="h-full rounded-full transition-all"
                :style="{
                  width: (progressById.get(goal.id)?.percent ?? 0) + '%',
                  backgroundColor: goal.color || '#3F9A6A',
                }"
              />
            </div>
            <div class="mt-2 flex items-center justify-between gap-2 text-sm">
              <span class="font-display font-bold">
                {{ formatBRL(progressById.get(goal.id)?.savedCents ?? 0) }}
                <span class="text-xs font-semibold text-muted-foreground">
                  de {{ formatBRL(goal.target_cents) }} ({{ progressById.get(goal.id)?.percent ?? 0 }}%)
                </span>
              </span>
              <Badge v-if="progressById.get(goal.id)?.completed" variant="success">concluída</Badge>
              <span v-else class="text-xs font-semibold text-muted-foreground">
                faltam {{ formatBRL(progressById.get(goal.id)?.remainingCents ?? 0) }}
              </span>
            </div>
          </div>

          <div class="flex flex-wrap gap-2">
            <Button size="sm" data-testid="goal-save" @click="openEntry(goal, 'guardar')">
              <PiggyBank class="h-3.5 w-3.5" /> Guardar
            </Button>
            <Button size="sm" variant="outline" @click="openEntry(goal, 'resgatar')">
              <Minus class="h-3.5 w-3.5" /> Resgatar
            </Button>
          </div>

          <ul v-if="historyOf(goal).length > 0" class="space-y-1 border-t border-border/60 pt-2 text-xs">
            <li
              v-for="entry in historyOf(goal)"
              :key="entry.id"
              class="flex items-center justify-between gap-2 text-muted-foreground"
            >
              <span class="min-w-0 truncate">
                {{ formatDate(entry.date) }}
                <template v-if="entry.note"> · {{ entry.note }}</template>
              </span>
              <span class="font-bold" :class="entry.amount_cents >= 0 ? 'text-leaf' : 'text-primary'">
                {{ entry.amount_cents >= 0 ? "+" : "−" }}{{ formatBRL(Math.abs(entry.amount_cents)) }}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>

    <Modal v-model="open" :title="editingId ? 'Editar meta' : 'Nova meta'">
      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="goal-name">Nome</Label>
          <Input id="goal-name" v-model="name" required maxlength="80" placeholder="Ex.: Viagem para a praia" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label for="goal-target">Objetivo (R$)</Label>
            <Input id="goal-target" v-model="target" inputmode="decimal" placeholder="0,00" required />
          </div>
          <div class="space-y-2">
            <Label for="goal-deadline">Até (opcional)</Label>
            <Input id="goal-deadline" v-model="deadline" type="date" />
          </div>
        </div>
        <div class="space-y-2">
          <Label for="goal-owner">De quem é a meta</Label>
          <Select id="goal-owner" v-model="owner">
            <option v-for="option in people.selectable" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="space-y-2">
          <Label>Cor</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in GOAL_COLORS"
              :key="item"
              type="button"
              class="h-8 w-8 rounded-full ring-offset-2 ring-offset-card transition"
              :class="item === color && 'ring-2'"
              :style="{ backgroundColor: item }"
              :aria-label="`cor ${item}`"
              @click="color = item"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="open = false">Cancelar</Button>
          <Button type="submit" :loading="saving">Salvar</Button>
        </div>
      </form>
    </Modal>

    <Modal
      v-model="entryOpen"
      :title="entryMode === 'guardar' ? 'Guardar na meta' : 'Resgatar da meta'"
      :description="entryGoal?.name ?? ''"
    >
      <form class="space-y-4" @submit.prevent="submitEntry">
        <div class="space-y-2">
          <Label for="entry-amount">Valor (R$)</Label>
          <Input id="entry-amount" v-model="entryAmount" inputmode="decimal" required />
        </div>
        <div class="space-y-2">
          <Label for="entry-date">Data</Label>
          <Input id="entry-date" v-model="entryDate" type="date" />
        </div>
        <div class="space-y-2">
          <Label for="entry-note">Observação (opcional)</Label>
          <Input id="entry-note" v-model="entryNote" maxlength="200" placeholder="Ex.: 13º salário" />
        </div>
        <div class="flex justify-end gap-2 pt-1">
          <Button variant="ghost" type="button" @click="entryOpen = false">Cancelar</Button>
          <Button type="submit" :loading="entrySaving">
            {{ entryMode === "guardar" ? "Guardar" : "Resgatar" }}
          </Button>
        </div>
      </form>
    </Modal>
  </div>
</template>
