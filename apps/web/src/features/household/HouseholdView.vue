<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useHouseholdStore } from "@/stores/household";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const household = useHouseholdStore();
const sync = useSyncStore();
const router = useRouter();
const toast = useToast();

const name = ref("");
const loading = ref(false);

async function submit(): Promise<void> {
  loading.value = true;
  try {
    await household.createHousehold(name.value);
    await sync.syncNow();
    toast.success("Família criada com categorias padrão.");
    router.push({ name: "dashboard" });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao criar a família.");
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void household.loadMembers();
});
</script>

<template>
  <div class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
    <div class="text-center">
      <h1 class="text-2xl font-bold">Sua família</h1>
      <p class="mt-2 text-sm text-muted-foreground">
        Crie o espaço da sua família para começar a organizar as finanças.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Criar família</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="submit">
          <div class="space-y-2">
            <Label for="household-name">Nome da família</Label>
            <Input id="household-name" v-model="name" required maxlength="80" placeholder="Ex.: Família Silva" />
          </div>
          <Button type="submit" class="w-full" :loading="loading">Criar e continuar</Button>
        </form>
      </CardContent>
    </Card>
  </div>
</template>
