<script setup lang="ts">
import { useSyncStore } from "@/stores/sync";
import { formatDateTime } from "@/lib/format";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";
import CardContent from "@/components/ui/CardContent.vue";

const sync = useSyncStore();
</script>

<template>
  <Card v-if="sync.conflicts.length > 0" class="border-amber-300">
    <CardHeader>
      <CardTitle>Conflitos de sincronização</CardTitle>
    </CardHeader>
    <CardContent class="space-y-3">
      <p class="text-sm text-muted-foreground">
        As alterações abaixo foram descartadas (o servidor venceu). Revise o estado atual.
      </p>
      <div
        v-for="conflict in sync.conflicts"
        :key="`${conflict.entity}-${conflict.id}`"
        class="rounded-md border p-3 text-sm"
      >
        <p class="font-medium">{{ conflict.entity }} · {{ conflict.reason }}</p>
        <p class="text-xs text-muted-foreground">
          Atualizado em {{ formatDateTime(conflict.serverRecord.updated ?? "") }}
        </p>
        <Button size="sm" variant="outline" class="mt-2" @click="sync.acknowledgeConflict(conflict.id)">
          Revisado
        </Button>
      </div>
    </CardContent>
  </Card>
</template>
