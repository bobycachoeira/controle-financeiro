<script setup lang="ts">
import { computed, onMounted, reactive } from "vue";
import {
  REMINDER_DAYS_OPTIONS,
  REMINDER_TYPES,
  type NotificationPreferences,
  type ReminderType,
} from "@cf/shared";
import { useNotificationsStore } from "@/stores/notifications";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const store = useNotificationsStore();
const toast = useToast();

const typeLabels: Record<ReminderType, string> = {
  contas_a_pagar: "Contas a pagar",
  contas_a_receber: "Contas a receber",
  fatura_cartao: "Faturas de cartão",
  fixas_recorrentes: "Contas fixas/recorrentes",
};

const form = reactive<NotificationPreferences>(structuredClone(store.preferences));

const types = computed(() => REMINDER_TYPES);

function toggleDay(type: ReminderType, day: number): void {
  const list = form[type].dias_antes;
  const index = list.indexOf(day);
  if (index >= 0) list.splice(index, 1);
  else list.push(day);
}

function isDaySelected(type: ReminderType, day: number): boolean {
  return form[type].dias_antes.includes(day);
}

async function activate(): Promise<void> {
  const ok = await store.enable();
  if (!ok) {
    toast.error("Não foi possível ativar as notificações neste dispositivo.");
    return;
  }
  toast.success("Notificações ativadas.");
}

async function deactivate(): Promise<void> {
  await store.disable();
  toast.info("Notificações desativadas.");
}

async function sendTest(): Promise<void> {
  try {
    await store.sendTest();
    toast.success("Notificação de teste enviada.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao enviar teste.");
  }
}

async function save(): Promise<void> {
  try {
    await store.save(form);
    toast.success("Preferências salvas.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  }
}

onMounted(async () => {
  try {
    await store.load();
    Object.assign(form, structuredClone(store.preferences));
  } catch {
    // mantém defaults
  }
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Notificações</h1>

    <Card>
      <CardHeader>
        <CardTitle>Ativar no dispositivo</CardTitle>
        <CardDescription>
          {{ store.supported ? "Receba lembretes de vencimentos no seu aparelho." : "Este dispositivo não suporta notificações push." }}
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-3">
        <p v-if="!store.supported" class="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Notificações indisponíveis aqui. Você pode continuar usando o app normalmente.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button v-if="!store.pushEnabled" :disabled="!store.supported" @click="activate">
            Ativar notificações
          </Button>
          <template v-else>
            <Button variant="outline" :disabled="!store.canTest" @click="sendTest">
              Enviar teste
            </Button>
            <Button variant="ghost" @click="deactivate">Desativar</Button>
          </template>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Preferências de lembrete</CardTitle>
        <CardDescription>Escolha tipos, antecedência, horário e período de silêncio.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div v-for="type in types" :key="type" class="space-y-2 rounded-md border p-3">
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="form[type].habilitado" type="checkbox" class="h-4 w-4" />
            {{ typeLabels[type] }}
          </label>
          <div class="flex flex-wrap gap-2" :class="form[type].habilitado ? '' : 'opacity-50'">
            <label
              v-for="day in REMINDER_DAYS_OPTIONS[type]"
              :key="day"
              class="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
            >
              <input
                type="checkbox"
                class="h-3 w-3"
                :disabled="!form[type].habilitado"
                :checked="isDaySelected(type, day)"
                @change="toggleDay(type, day)"
              />
              {{ day }}d
            </label>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="horario">Horário preferido de envio</Label>
          <Input id="horario" v-model="form.horario_envio" type="time" />
        </div>

        <div class="space-y-2 rounded-md border p-3">
          <label class="flex items-center gap-2 text-sm font-medium">
            <input v-model="form.quiet_hours.ativar" type="checkbox" class="h-4 w-4" />
            Período de silêncio (quiet hours)
          </label>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <Label for="quiet-inicio">Início</Label>
              <Input id="quiet-inicio" v-model="form.quiet_hours.inicio" type="time" />
            </div>
            <div class="space-y-1">
              <Label for="quiet-fim">Fim</Label>
              <Input id="quiet-fim" v-model="form.quiet_hours.fim" type="time" />
            </div>
          </div>
        </div>

        <Button @click="save">Salvar preferências</Button>
      </CardContent>
    </Card>
  </div>
</template>
