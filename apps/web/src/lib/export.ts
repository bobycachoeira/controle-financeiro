import type { LocalAccount, LocalCategory, LocalTransaction } from "@/db/schema";
import { db } from "@/db/schema";
import { readUxMetrics } from "@/lib/ux-metrics";

function csvCell(value: string): string {
  const text = value ?? "";
  if (/[";\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}

export function formatCentsForCsv(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export interface TransactionsCsvInput {
  transactions: readonly LocalTransaction[];
  accounts: readonly LocalAccount[];
  categories: readonly LocalCategory[];
  attributionLabel: (key: string) => string;
}

/** CSV (separado por ";", decimal com vírgula) pronto para Excel/Sheets BR. */
export function transactionsCsv(input: TransactionsCsvInput): string {
  const accountById = new Map(input.accounts.map((account) => [account.id, account]));
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const header = [
    "Data",
    "Estabelecimento",
    "Descrição",
    "Valor",
    "Tipo",
    "Status",
    "Conta",
    "Categoria",
    "Atribuição",
    "Etiquetas",
    "Nota",
  ];
  const rows = [...input.transactions]
    .filter((tx) => !tx.deleted_at)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((tx) => {
      const signed =
        tx.type === "transferencia"
          ? tx.amount_cents
          : tx.type === "receita"
            ? tx.amount_cents
            : -tx.amount_cents;
      return [
        tx.date.slice(0, 10),
        tx.merchant ?? "",
        tx.description,
        formatCentsForCsv(signed),
        tx.type,
        tx.status,
        accountById.get(tx.account)?.name ?? tx.account,
        tx.category ? (categoryById.get(tx.category)?.name ?? tx.category) : "",
        input.attributionLabel(tx.attribution),
        (tx.tags ?? []).join(", "),
        tx.note ?? "",
      ];
    });
  return toCsv([header, ...rows]);
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const BACKUP_TABLES = [
  ["accounts", db.accounts],
  ["credit_cards", db.credit_cards],
  ["categories", db.categories],
  ["transactions", db.transactions],
  ["installments", db.installments],
  ["invoices", db.invoices],
  ["transfers", db.transfers],
  ["bills", db.bills],
  ["recurrences", db.recurrences],
  ["budgets", db.budgets],
  ["goals", db.goals],
  ["exchange_rates", db.exchange_rates],
] as const;

/** Backup JSON completo da família (para guardar em lugar seguro). */
export async function collectHouseholdBackup(household: string): Promise<string> {
  const data: Record<string, unknown[]> = {};
  for (const [name, table] of BACKUP_TABLES) {
    data[name] = await table.where("household").equals(household).toArray();
  }
  const householdRecord = await db.households.get(household);
  return JSON.stringify(
    {
      app: "controle-financeiro",
      version: 1,
      exported_at: new Date().toISOString(),
      household: householdRecord
        ? {
            id: householdRecord.id,
            name: householdRecord.name,
            settings: householdRecord.settings ?? {},
          }
        : null,
      data,
      ux_metrics: readUxMetrics(),
    },
    null,
    2,
  );
}
