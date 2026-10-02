<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { Role } from "@cf/shared";
import { INVITE_ROLES } from "@cf/shared";
import { useHouseholdStore } from "@/stores/household";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/api/client";
import StepUpDialog from "@/features/auth/StepUpDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const household = useHouseholdStore();
const session = useSessionStore();
const toast = useToast();

const email = ref("");
const role = ref<Role>("partner");
const sending = ref(false);
const stepUpOpen = ref(false);

const roleLabels: Record<string, string> = {
  owner: "Titular",
  partner: "Parceiro(a)",
  teen: "Adolescente",
  child: "Criança",
  viewer: "Visualizador",
};

async function send(): Promise<void> {
  sending.value = true;
  try {
    await household.createInvite(email.value, role.value);
    toast.success("Convite criado e enviado.");
    email.value = "";
  } catch (error) {
    if (error instanceof ApiError && error.isStepUpRequired) {
      stepUpOpen.value = true;
    } else if (error instanceof ApiError && error.status === 409) {
      toast.error("Limite de 2 adultos plenos atingido.");
    } else {
      toast.error(error instanceof Error ? error.message : "Falha ao convidar.");
    }
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  void household.loadMembers();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">Família e convites</h1>
      <p class="text-sm text-muted-foreground">Gerencie membros e papéis.</p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Membros</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="divide-y">
          <li
            v-for="member in household.members"
            :key="member.id"
            class="flex items-center justify-between py-3 text-sm"
          >
            <span>{{ member.user }}</span>
            <Badge variant="secondary">{{ roleLabels[member.role] ?? member.role }}</Badge>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Convidar membro</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="send">
          <div class="space-y-2">
            <Label for="invite-email">E-mail</Label>
            <Input id="invite-email" v-model="email" type="email" required />
          </div>
          <div class="space-y-2">
            <Label for="invite-role">Papel</Label>
            <Select id="invite-role" v-model="role">
              <option v-for="option in INVITE_ROLES" :key="option" :value="option">
                {{ roleLabels[option] ?? option }}
              </option>
            </Select>
          </div>
          <Button type="submit" :loading="sending" :disabled="!session.hasHousehold">
            Enviar convite
          </Button>
        </form>
      </CardContent>
    </Card>

    <StepUpDialog v-model="stepUpOpen" @verified="send" />
  </div>
</template>
