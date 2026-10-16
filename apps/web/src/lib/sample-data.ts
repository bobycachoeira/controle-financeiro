import { pad2, todayISO } from "@cf/shared";
import { db } from "@/db/schema";
import { useAccountsStore } from "@/stores/accounts";
import { useSessionStore } from "@/stores/session";
import { useSyncStore } from "@/stores/sync";
import { useTransactionsStore } from "@/stores/transactions";

export interface SampleSeedResult {
  accounts: number;
  transactions: number;
}

async function categoryIdByName(household: string, name: string): Promise<string | null> {
  const categories = await db.categories.where("household").equals(household).toArray();
  return categories.find((category) => !category.deleted_at && category.name === name)?.id ?? null;
}

/** O primeiro uso pode acontecer antes do sync trazer as categorias. */
async function waitForCategories(household: string, timeoutMs = 2500): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const count = await db.categories.where("household").equals(household).count();
    if (count > 0) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
}

/**
 * Preenche a família com dados de exemplo (contas, lançamentos e uma conta a
 * pagar) para conhecer o app. Tudo fica editável/apagável como dados normais.
 */
export async function seedSampleData(): Promise<SampleSeedResult> {
  const session = useSessionStore();
  const household = session.currentHouseholdId;
  if (!household) throw new Error("Sem família para preencher.");
  const accounts = useAccountsStore();
  const transactions = useTransactionsStore();
  const today = todayISO();
  const month = today.slice(0, 7);
  const dayOfMonth = Number(today.slice(8, 10));

  const checking = await accounts.create({
    name: "Conta do dia a dia",
    type: "corrente",
    initial_balance_cents: 320000,
  });
  await accounts.create({
    name: "Poupança",
    type: "poupanca",
    initial_balance_cents: 500000,
  });

  // Garante que as categorias do servidor chegaram antes de categorizar:
  // espera o sync inicial terminar e força um pull novo se ainda faltar.
  const sync = useSyncStore();
  const waitStarted = Date.now();
  while (sync.syncing && Date.now() - waitStarted < 5000) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  try {
    await sync.syncNow();
  } catch {
    // offline: segue com os fallbacks locais
  }
  await waitForCategories(household);
  const mercado = await categoryIdByName(household, "Supermercado");
  const combustivel = await categoryIdByName(household, "Combustível");
  const lazer = await categoryIdByName(household, "Lazer");
  // Se as categorias ainda não chegaram do sync, cai no "Outros"/"Outras receitas"
  // (mesma regra do formulário) para nada ficar sem categoria no servidor.
  const outrosSaida = await categoryIdByName(household, "Outros");
  const outrosEntrada = await categoryIdByName(household, "Outras receitas");

  const entries: Array<{
    amount: number;
    type: "receita" | "despesa";
    description: string;
    category: string | null;
    status: "pago" | "a_pagar";
    wantedDay: number;
  }> = [
    { amount: 450000, type: "receita", description: "Salário", category: null, status: "pago", wantedDay: 5 },
    { amount: 18990, type: "despesa", description: "Mercado da semana", category: mercado, status: "pago", wantedDay: 6 },
    { amount: 14990, type: "despesa", description: "Gasolina", category: combustivel, status: "pago", wantedDay: 8 },
    { amount: 3990, type: "despesa", description: "Streaming", category: lazer, status: "pago", wantedDay: 10 },
    { amount: 8990, type: "despesa", description: "Consulta dentista", category: null, status: "a_pagar", wantedDay: 25 },
  ];

  let created = 0;
  for (const entry of entries) {
    const day =
      entry.status === "a_pagar"
        ? Math.min(Math.max(dayOfMonth + 3, entry.wantedDay), 28)
        : Math.min(entry.wantedDay, dayOfMonth);
    await transactions.create({
      account: checking.id,
      credit_card: null,
      amount_cents: entry.amount,
      type: entry.type,
      date: `${month}-${pad2(Math.max(1, day))}`,
      attribution: "ambos",
      category: entry.category ?? (entry.type === "receita" ? outrosEntrada : outrosSaida),
      description: entry.description,
      status: entry.status,
    });
    created += 1;
  }

  return { accounts: 2, transactions: created };
}
