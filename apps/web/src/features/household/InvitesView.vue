<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { Role } from "@cf/shared";
import { INVITE_ROLES } from "@cf/shared";
import { useHouseholdStore } from "@/stores/household";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/api/client";
import type { JoinRequest } from "@/api/household-api";
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
const people = usePeopleStore();
const session = useSessionStore();
const toast = useToast();

const email = ref("");
const role = ref<Role>("partner");
const sending = ref(false);
const stepUpOpen = ref(false);
let pendingAfterStepUp: (() => Promise<void>) | null = null;

const approveTarget = ref<JoinRequest | null>(null);
const approveRole = ref<Role>("child");
const approvePersonKey = ref("");

const APPROVE_ROLES: Role[] = ["owner", "partner", "teen", "child", "viewer"];

const roleLabels: Record<string, string> = {
  owner: "Titular",
  partner: "Parceiro(a)",
  teen: "Adolescente",
  child: "Criança",
  viewer: "Visualizador",
};

const isOwner = () => session.currentRole === "owner";

async function guarded(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof ApiError && error.isStepUpRequired) {
      pendingAfterStepUp = action;
      stepUpOpen.value = true;
    } else if (error instanceof ApiError && error.status === 409) {
      toast.error("Limite de 2 adultos plenos atingido.");
    } else {
      toast.error(error instanceof Error ? error.message : "Falha na operação.");
    }
  }
}

function onVerified(): void {
  const action = pendingAfterStepUp;
  pendingAfterStepUp = null;
  if (action) void guarded(action);
}

async function send(): Promise<void> {
  sending.value = true;
  try {
    await guarded(async () => {
      await household.createInvite(email.value, role.value);
      toast.success("Convite criado e enviado.");
      email.value = "";
    });
  } finally {
    sending.value = false;
  }
}

function openApprove(request: JoinRequest): void {
  approveTarget.value = request;
  approveRole.value = (APPROVE_ROLES.includes(request.role_suggested as Role)
    ? request.role_suggested
    : "child") as Role;
  approvePersonKey.value = "";
}

async function confirmApprove(): Promise<void> {
  const target = approveTarget.value;
  if (!target) return;
  await guarded(async () => {
    await household.approveJoinRequest(target.id, approveRole.value, approvePersonKey.value || undefined);
    toast.success(`${target.user_name || target.email} aprovado(a).`);
    approveTarget.value = null;
  });
}

async function reject(request: JoinRequest): Promise<void> {
  await guarded(async () => {
    await household.rejectJoinRequest(request.id);
    toast.success("Solicitação recusada.");
  });
}

function changeRole(memberId: string, next: string): void {
  void guarded(async () => {
    await household.updateMemberRole(memberId, next as Role);
    toast.success("Papel atualizado.");
  });
}

onMounted(() => {
  void household.loadMembers();
  if (isOwner()) void household.loadJoinRequests();
  void people.load();
});
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-bold">Família e convites</h1>
      <p class="text-sm text-muted-foreground">Gerencie membros, solicitações e papéis.</p>
    </div>

    <Card v-if="isOwner() && household.joinRequests.length > 0">
      <CardHeader>
        <CardTitle>Solicitações de entrada</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="divide-y">
          <li
            v-for="request in household.joinRequests"
            :key="request.id"
            class="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="text-sm">
              <p class="font-medium">{{ request.user_name || request.email }}</p>
              <p class="text-muted-foreground">{{ request.email }}</p>
            </div>
            <div class="flex gap-2">
              <Button size="sm" @click="openApprove(request)">Aprovar</Button>
              <Button size="sm" variant="outline" @click="reject(request)">Recusar</Button>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Membros</CardTitle>
      </CardHeader>
      <CardContent>
        <ul class="divide-y">
          <li
            v-for="member in household.members"
            :key="member.id"
            class="flex items-center justify-between gap-3 py-3 text-sm"
          >
            <span>{{ member.user_name || member.user }}</span>
            <Select
              v-if="isOwner()"
              :model-value="member.role"
              class="w-40"
              @update:model-value="(value: string) => changeRole(member.id, value)"
            >
              <option v-for="option in APPROVE_ROLES" :key="option" :value="option">
                {{ roleLabels[option] ?? option }}
              </option>
            </Select>
            <Badge v-else variant="secondary">{{ roleLabels[member.role] ?? member.role }}</Badge>
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
            <Label for="invite-role">Papel sugerido</Label>
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

    <div
      v-if="approveTarget"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      @click.self="approveTarget = null"
    >
      <Card class="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aprovar {{ approveTarget.user_name || approveTarget.email }}</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="approve-role">Papel</Label>
            <Select id="approve-role" v-model="approveRole">
              <option v-for="option in APPROVE_ROLES" :key="option" :value="option">
                {{ roleLabels[option] ?? option }}
              </option>
            </Select>
          </div>
          <div class="space-y-2">
            <Label for="approve-person">Vincular a uma pessoa</Label>
            <Select id="approve-person" v-model="approvePersonKey">
              <option value="">Criar nova pessoa ({{ approveTarget.user_name || approveTarget.email }})</option>
              <option v-for="option in people.options" :key="option.key" :value="option.key">
                {{ option.label }}
              </option>
            </Select>
          </div>
          <div class="flex justify-end gap-2">
            <Button variant="outline" @click="approveTarget = null">Cancelar</Button>
            <Button @click="confirmApprove">Aprovar</Button>
          </div>
        </CardContent>
      </Card>
    </div>

    <StepUpDialog v-model="stepUpOpen" @verified="onVerified" />
  </div>
</template>
