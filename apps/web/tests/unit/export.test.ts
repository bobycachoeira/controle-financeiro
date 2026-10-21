import { describe, expect, it } from "vitest";
import { collectHouseholdBackup, formatCentsForCsv, toCsv, transactionsCsv } from "@/lib/export";
import { db, type LocalAccount, type LocalCategory, type LocalTransaction } from "@/db/schema";

function tx(partial: Partial<LocalTransaction> & { id: string }): LocalTransaction {
  return {
    household: "h1",
    sync_id: `s-${partial.id}`,
    account: "a1",
    credit_card: null,
    amount_cents: 1000,
    currency: "BRL",
    type: "despesa",
    date: "2026-10-10",
    attribution: "meu",
    category: "c1",
    merchant: "",
    description: "Mercado",
    status: "pago",
    tags: [],
    note: "",
    origin: "manual",
    updated_by: null,
    deleted_at: null,
    ...partial,
  };
}

const account = { id: "a1", name: "Conta; Principal" } as LocalAccount;
const category = { id: "c1", name: 'Categoria "X"' } as LocalCategory;

describe("export", () => {
  it("escapa células com ponto e vírgula, aspas e quebra de linha", () => {
    expect(toCsv([["a;b", 'c"d', "e\nf", "simples"]])).toBe(
      '"a;b";"c""d";"e\nf";simples',
    );
  });

  it("formata centavos com vírgula decimal", () => {
    expect(formatCentsForCsv(18990)).toBe("189,90");
    expect(formatCentsForCsv(-500)).toBe("-5,00");
  });

  it("monta o CSV de lançamentos com sinal e nomes", () => {
    const csv = transactionsCsv({
      transactions: [
        tx({ id: "t1", amount_cents: 18990, merchant: "Assaí" }),
        tx({ id: "t2", amount_cents: 5000, type: "receita", category: null }),
      ],
      accounts: [account],
      categories: [category],
      attributionLabel: () => "Paulo",
    });
    const lines = csv.split("\r\n");
    expect(lines[0]).toContain("Data;Estabelecimento;Descrição;Valor");
    expect(lines[1]).toContain('"Conta; Principal"');
    expect(lines[1]).toContain('"Categoria ""X"""');
    expect(lines[1]).toContain("Assaí");
    expect(lines[1]).toContain("-189,90");
    expect(lines[2]).toContain("50,00");
  });

  it("monta o backup JSON da família", async () => {
    await db.transactions.clear();
    await db.transactions.put(tx({ id: "t1" }));

    const json = await collectHouseholdBackup("h1");
    const parsed = JSON.parse(json) as {
      app: string;
      data: { transactions: Array<{ id: string }> };
    };
    expect(parsed.app).toBe("controle-financeiro");
    expect(parsed.data.transactions.map((item) => item.id)).toEqual(["t1"]);
  });
});
