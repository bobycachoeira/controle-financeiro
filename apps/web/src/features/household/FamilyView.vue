<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import type { Role } from "@cf/shared";
import { INVITE_ROLES } from "@cf/shared";
import { Plus, Trash2 } from "lucide-vue-next";
import { useHouseholdStore } from "@/stores/household";
import { usePeopleStore } from "@/stores/people";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useToast } from "@/composables/useToast";
import { ApiError } from "@/api/client";
import type { JoinRequest, MemberRecord } from "@/api/household-api";
import StepUpDialog from "@/features/auth/StepUpDialog.vue";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Badge from "@/components/ui/Badge.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";
import Select from "@/components/ui/Select.vue";

const household = useHouseholdStore();
const people = usePeopleStore();
const session = useSessionStore();
const sync = useSyncStore();
const toast = useToast();

const email = ref("");
const role = ref<Role>("partner");
const sending = ref(false);
const stepUpOpen = ref(false);
let pendingAfterStepUp: (() => Promise<void>) | null = null;

const approveTarget = ref<JoinRequest | null>(null);
const approveRole = ref<Role>("child");
const approvePersonKey = ref("");

interface DraftPerson {
  key: string;
  label: string;
  userId?: string;
}
const draft = ref<DraftPerson[]>([]);

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

async function sendInvite(): Promise<void> {
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

function toggleAudit(member: MemberRecord): void {
  void guarded(async () => {
    const permissions = { ...(member.permissions ?? {}), audit: !member.permissions?.audit };
    await household.updateMemberPermissions(member.id, permissions);
    toast.success("Permissão atualizada.");
  });
}

function memberName(userId: string): string {
  const member = session.members.find((item) => item.user === userId);
  return member?.user_name || member?.user || userId;
}

function resetPeople(): void {
  draft.value = people.options.map((option) => ({
    key: option.key,
    label: option.label,
    userId: option.userId,
  }));
}

function addPerson(): void {
  draft.value.push({ key: `pessoa-${Math.random().toString(36).slice(2, 7)}`, label: "" });
}

function linkUser(person: DraftPerson, event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  person.userId = value || undefined;
  if (value && !person.label.trim()) person.label = memberName(value);
}

function removePerson(index: number): void {
  draft.value.splice(index, 1);
}

async function savePeople(): Promise<void> {
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
  resetPeople();
  toast.success("Pessoas atualizadas.");
}

async function loadAll(): Promise<void> {
  await household.loadMembers();
  if (isOwner()) await household.loadJoinRequests();
  await people.load();
  resetPeople();
}

onMounted(async () => {
  await session.loadMe().catch(() => {});
  await loadAll();
});
watch(
  () => sync.dataVersion,
  async () => {
    await session.loadMe().catch(() => {});
    await loadAll();
  },
);
</script>

<template>
  <div class="space-y-6">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Família</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Família</h1>
      <p class="text-sm text-muted-foreground">Membros, convites, solicitações e atribuições.</p>
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
            class="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
          >
            <span class="min-w-0 truncate">{{ member.user_name || member.user }}</span>
            <div class="flex items-center gap-2">
              <button
                v-if="isOwner() && member.role !== 'owner'"
                type="button"
                class="rounded-full px-2 py-0.5 text-[0.58rem] font-black uppercase tracking-wider transition"
                :class="
                  member.permissions?.audit
                    ? 'bg-leaf/20 text-leaf'
                    : 'bg-muted text-muted-foreground'
                "
                @click="toggleAudit(member)"
              >
                Auditoria
              </button>
              <Select
                v-if="isOwner()"
                :model-value="member.role"
                class="w-36"
                @update:model-value="(value: string) => changeRole(member.id, value)"
              >
                <option v-for="option in APPROVE_ROLES" :key="option" :value="option">
                  {{ roleLabels[option] ?? option }}
                </option>
              </Select>
              <Badge v-else variant="secondary">{{ roleLabels[member.role] ?? member.role }}</Badge>
            </div>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Convidar membro</CardTitle>
      </CardHeader>
      <CardContent>
        <form class="space-y-4" @submit.prevent="sendInvite">
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
          <Button type="submit" :loading="sending" :disabled="!session.hasHousehold">Enviar convite</Button>
        </form>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Quem participa</CardTitle>
        <CardDescription>
          Cada pessoa pode estar ligada a um usuário (quem entra no app) ou não — ex.: uma filha
          sem conta. O nome aparece na atribuição e nos gastos do mês.
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
              @click="removePerson(index)"
            >
              <Trash2 class="h-3.5 w-3.5" /> Remover
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
          <Button variant="outline" size="sm" @click="addPerson"><Plus class="h-4 w-4" /> Adicionar pessoa</Button>
          <Button @click="savePeople">Salvar</Button>
        </div>
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
