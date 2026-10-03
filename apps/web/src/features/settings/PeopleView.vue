<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const people = usePeopleStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

interface DraftPerson {
  key: string;
  label: string;
  userId?: string;
}

const draft = ref<DraftPerson[]>([]);

function reset(): void {
  draft.value = people.options.map((option) => ({
    key: option.key,
    label: option.label,
    userId: option.userId,
  }));
}

function add(): void {
  draft.value.push({ key: `pessoa-${Math.random().toString(36).slice(2, 7)}`, label: "" });
}

function memberName(userId: string): string {
  const member = session.members.find((item) => item.user === userId);
  return member?.user_name || member?.user || userId;
}

function linkUser(person: DraftPerson, event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  person.userId = value || undefined;
  if (value && !person.label.trim()) person.label = memberName(value);
}

function remove(index: number): void {
  draft.value.splice(index, 1);
}

async function save(): Promise<void> {
  const clean = draft.value
    .map((item) => ({
      key: item.key,
      label: item.label.trim() || (item.userId ? memberName(item.userId) : ""),
      userId: item.userId,
    }))
    .filter((item) => item.label);
  if (clean.length === 0) {
    toast.error("Adicione ao menos uma pessoa.");
    return;
  }
  await people.save(clean);
  toast.success("Pessoas atualizadas.");
}

onMounted(async () => {
  if (session.members.length === 0) await session.loadMe().catch(() => {});
  await people.load();
  reset();
});
watch(() => sync.dataVersion, async () => {
  await session.loadMe().catch(() => {});
  await people.load();
  reset();
});
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Personalização</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Pessoas</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Quem participa</CardTitle>
        <CardDescription>
          Cada pessoa pode estar ligada a um usuário (quem entra no app) ou não — ex.: uma
          filha sem conta. O nome aparece na atribuição e nos gastos do mês.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div
          v-for="(person, index) in draft"
          :key="person.key"
          class="space-y-2 rounded-2xl border-2 border-border p-3"
        >
          <div class="space-y-1">
            <Label :for="`person-${index}`">Nome</Label>
            <Input :id="`person-${index}`" v-model="person.label" placeholder="Ex.: João / Filha" maxlength="40" />
          </div>
          <div class="space-y-1">
            <Label :for="`person-user-${index}`">Usuário vinculado</Label>
            <Select
              :id="`person-user-${index}`"
              :model-value="person.userId ?? ''"
              @change="linkUser(person, $event)"
            >
              <option value="">Sem usuário (opcional)</option>
              <option v-for="member in session.members" :key="member.user" :value="member.user">
                {{ member.user_name || member.user }}
                <template v-if="member.user === session.user?.id">(eu)</template>
              </option>
            </Select>
          </div>
          <div class="flex justify-end">
            <button
              v-if="draft.length > 1"
              type="button"
              class="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground transition hover:text-destructive"
              @click="remove(index)"
            >
              <Trash2 class="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" @click="add"><Plus class="h-4 w-4" /> Adicionar pessoa</Button>
          <Button @click="save">Salvar</Button>
        </div>
      </CardContent>
    </Card>

    <p class="px-1 text-xs text-muted-foreground">
      A opção <strong>Ambos</strong> (gastos compartilhados) já vem incluída automaticamente.
      Convide novos usuários em <strong>Família e convites</strong>.
    </p>
  </div>
</template>
