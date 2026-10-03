<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { Plus, Trash2 } from "lucide-vue-next";
import { usePeopleStore } from "@/stores/people";
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

const people = usePeopleStore();
const sync = useSyncStore();
const toast = useToast();

const draft = ref<{ key: string; label: string }[]>([]);

function reset(): void {
  draft.value = people.options.map((option) => ({ ...option }));
}

function add(): void {
  draft.value.push({ key: `pessoa-${Math.random().toString(36).slice(2, 7)}`, label: "" });
}

function remove(index: number): void {
  draft.value.splice(index, 1);
}

async function save(): Promise<void> {
  const clean = draft.value
    .map((item) => ({ key: item.key, label: item.label.trim() }))
    .filter((item) => item.label);
  if (clean.length === 0) {
    toast.error("Adicione ao menos uma pessoa.");
    return;
  }
  await people.save(clean);
  toast.success("Pessoas atualizadas.");
}

onMounted(async () => {
  await people.load();
  reset();
});
watch(() => sync.dataVersion, async () => {
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
          Dê nomes às pessoas (ex.: você, parceiro(a), filhos). Aparecem na atribuição dos
          lançamentos e nos gastos do mês.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <div v-for="(person, index) in draft" :key="person.key" class="flex items-end gap-2">
          <div class="flex-1 space-y-1">
            <Label :for="`person-${index}`">Nome</Label>
            <Input :id="`person-${index}`" v-model="person.label" placeholder="Ex.: João" maxlength="40" />
          </div>
          <Button
            v-if="draft.length > 1"
            size="icon"
            variant="ghost"
            aria-label="Remover pessoa"
            @click="remove(index)"
          >
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" @click="add"><Plus class="h-4 w-4" /> Adicionar pessoa</Button>
          <Button @click="save">Salvar</Button>
        </div>
      </CardContent>
    </Card>

    <p class="px-1 text-xs text-muted-foreground">
      A opção <strong>Ambos</strong> (gastos compartilhados) já vem incluída automaticamente.
    </p>
  </div>
</template>
