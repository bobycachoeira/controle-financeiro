<script setup lang="ts">
import { ref, watch } from "vue";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { loadTokens } from "@/api/tokens";
import Modal from "@/components/ui/Modal.vue";
import Button from "@/components/ui/Button.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{ "update:modelValue": [boolean]; verified: [] }>();

const session = useSessionStore();
const toast = useToast();
const code = ref("");
const loading = ref(false);

watch(
  () => props.modelValue,
  (open) => {
    if (open) code.value = "";
  },
);

async function verify(): Promise<void> {
  const sessionToken = loadTokens()?.token;
  if (!sessionToken) return;
  loading.value = true;
  try {
    const result = await session.verify2fa(sessionToken, code.value, "totp", false);
    if (result.step_up_token) session.setStepUp(result.step_up_token);
    toast.success("Ação liberada.");
    emit("update:modelValue", false);
    emit("verified");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Código inválido.");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    title="Confirme sua identidade"
    description="Esta ação sensível exige um código 2FA."
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form class="space-y-4" @submit.prevent="verify">
      <div class="space-y-2">
        <Label for="stepup-code">Código do autenticador</Label>
        <Input id="stepup-code" v-model="code" inputmode="numeric" autocomplete="one-time-code" required />
      </div>
      <div class="flex justify-end gap-2">
        <Button variant="ghost" @click="emit('update:modelValue', false)">Cancelar</Button>
        <Button type="submit" :loading="loading">Confirmar</Button>
      </div>
    </form>
  </Modal>
</template>
