<script setup lang="ts">
import { onMounted, ref } from "vue";
import { featuresApi, type FeatureFlags } from "@/api/features-api";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import Badge from "@/components/ui/Badge.vue";

const flags = ref<FeatureFlags | null>(null);

onMounted(async () => {
  try {
    flags.value = await featuresApi.flags();
  } catch {
    flags.value = { open_finance_enabled: false, passkeys_enabled: false };
  }
});
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-bold">Integrações</h1>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>Open Finance</CardTitle>
          <Badge :variant="flags?.open_finance_enabled ? 'success' : 'secondary'">
            {{ flags?.open_finance_enabled ? "habilitado" : "desligado" }}
          </Badge>
        </div>
        <CardDescription>Conexão somente leitura com bancos (depende de provedor).</CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="!flags?.open_finance_enabled" class="text-sm text-muted-foreground">
          Disponível quando o administrador habilitar a integração.
        </p>
        <p v-else class="text-sm text-muted-foreground">
          Nenhum provedor configurado. Fale com o administrador para conectar.
        </p>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <div class="flex items-center justify-between">
          <CardTitle>Passkeys</CardTitle>
          <Badge :variant="flags?.passkeys_enabled ? 'success' : 'secondary'">
            {{ flags?.passkeys_enabled ? "habilitado" : "em preparação" }}
          </Badge>
        </div>
        <CardDescription>Uso de passkeys como segundo fator (step-up).</CardDescription>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">
          O TOTP continua sendo o fator principal. A verificação server-side de passkeys será
          habilitada em uma próxima atualização.
        </p>
      </CardContent>
    </Card>
  </div>
</template>
