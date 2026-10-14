<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Database, FileSpreadsheet } from "lucide-vue-next";
import { todayISO } from "@cf/shared";
import { db, type LocalCategory } from "@/db/schema";
import { useSessionStore } from "@/stores/session";
import { useAccountsStore } from "@/stores/accounts";
import { usePeopleStore } from "@/stores/people";
import { useTransactionsStore } from "@/stores/transactions";
import { useToast } from "@/composables/useToast";
import { collectHouseholdBackup, downloadTextFile, transactionsCsv } from "@/lib/export";
import Button from "@/components/ui/Button.vue";
import Card from "@/components/ui/Card.vue";
import CardContent from "@/components/ui/CardContent.vue";
import CardDescription from "@/components/ui/CardDescription.vue";
import CardHeader from "@/components/ui/CardHeader.vue";
import CardTitle from "@/components/ui/CardTitle.vue";

const session = useSessionStore();
const accountsStore = useAccountsStore();
const people = usePeopleStore();
const transactionsStore = useTransactionsStore();
const toast = useToast();

const categories = ref<LocalCategory[]>([]);
const busyCsv = ref(false);
const busyBackup = ref(false);

async function loadAll(): Promise<void> {
  await Promise.all([accountsStore.load(), transactionsStore.load(), people.load()]);
  if (session.currentHouseholdId) {
    categories.value = (
      await db.categories.where("household").equals(session.currentHouseholdId).toArray()
    ).filter((category) => !category.deleted_at);
  }
}

function exportCsv(): void {
  busyCsv.value = true;
  try {
    const csv = transactionsCsv({
      transactions: transactionsStore.items,
      accounts: accountsStore.items,
      categories: categories.value,
      attributionLabel: (key) => (key === "indefinido" ? "" : people.label(key)),
    });
    // BOM para o Excel reconhecer os acentos.
    downloadTextFile(`lancamentos-${todayISO()}.csv`, `\uFEFF${csv}`, "text/csv;charset=utf-8");
    toast.success("CSV gerado.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao exportar.");
  } finally {
    busyCsv.value = false;
  }
}

async function exportBackup(): Promise<void> {
  if (!session.currentHouseholdId) return;
  busyBackup.value = true;
  try {
    const json = await collectHouseholdBackup(session.currentHouseholdId);
    downloadTextFile(`backup-${todayISO()}.json`, json, "application/json");
    toast.success("Backup gerado.");
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Falha ao gerar o backup.");
  } finally {
    busyBackup.value = false;
  }
}

onMounted(loadAll);
</script>

<template>
  <div class="space-y-5">
    <div>
      <p class="text-xs font-extrabold uppercase tracking-wider text-primary">Portabilidade</p>
      <h1 class="font-display text-3xl font-black tracking-tight">Exportar dados</h1>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Lançamentos (CSV)</CardTitle>
        <CardDescription>
          Planilha com todos os lançamentos: data, valor, conta, categoria, atribuição, etiquetas e
          nota. Abre no Excel e no Google Sheets.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" :loading="busyCsv" @click="exportCsv">
          <FileSpreadsheet class="h-4 w-4" /> Baixar CSV
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Backup completo (JSON)</CardTitle>
        <CardDescription>
          Tudo da família em um arquivo: contas, cartões, lançamentos, faturas, contas a pagar,
          orçamentos, metas e recorrências. Guarde em lugar seguro.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" :loading="busyBackup" @click="exportBackup">
          <Database class="h-4 w-4" /> Baixar backup
        </Button>
      </CardContent>
    </Card>
  </div>
</template>
