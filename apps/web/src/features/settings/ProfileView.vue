<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Camera, Trash2 } from "lucide-vue-next";
import { useSessionStore } from "@/stores/session";
import { useToast } from "@/composables/useToast";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import Input from "@/components/ui/Input.vue";
import Label from "@/components/ui/Label.vue";

const session = useSessionStore();
const toast = useToast();

const name = ref("");
const avatar = ref<string | null>(null);
const avatarChanged = ref(false);
const saving = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const initials = () => (session.user?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

function reset(): void {
  name.value = session.user?.name ?? "";
  avatar.value = session.user?.avatar ?? null;
  avatarChanged.value = false;
}

function pick(): void {
  fileInput.value?.click();
}

function resize(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("Imagem inválida."));
      image.onload = () => {
        const max = 320;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

async function onFile(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    avatar.value = await resize(file);
    avatarChanged.value = true;
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao carregar a imagem.");
  }
}

function removeAvatar(): void {
  avatar.value = null;
  avatarChanged.value = true;
}

async function save(): Promise<void> {
  const value = name.value.trim();
  if (!value) {
    toast.error("Informe um nome.");
    return;
  }
  saving.value = true;
  try {
    await session.updateProfile({
      name: value,
      ...(avatarChanged.value ? { avatar: avatar.value } : {}),
    });
    avatarChanged.value = false;
    toast.success("Perfil atualizado.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
  } finally {
    saving.value = false;
  }
}

onMounted(reset);
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Conta</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Perfil</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Seus dados</CardTitle>
        <CardDescription>O nome e a foto aparecem na Home e nas atribuições.</CardDescription>
      </CardHeader>
      <CardContent class="space-y-5">
        <div class="flex items-center gap-4">
          <div
            class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-2xl font-black text-muted-foreground"
          >
            <img v-if="avatar" :src="avatar" alt="" class="h-full w-full object-cover" />
            <span v-else>{{ initials() }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" @click="pick"><Camera class="h-4 w-4" /> Trocar foto</Button>
            <Button v-if="avatar" variant="ghost" size="sm" @click="removeAvatar">
              <Trash2 class="h-4 w-4" /> Remover
            </Button>
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              class="hidden"
              @change="onFile"
            />
          </div>
        </div>

        <div class="space-y-2">
          <Label for="profile-name">Nome</Label>
          <Input id="profile-name" v-model="name" maxlength="60" placeholder="Como quer ser chamado" />
        </div>
        <div class="space-y-2">
          <Label for="profile-email">E-mail</Label>
          <Input id="profile-email" :model-value="session.user?.email ?? ''" disabled />
        </div>
        <div class="flex justify-end">
          <Button :loading="saving" @click="save">Salvar</Button>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
