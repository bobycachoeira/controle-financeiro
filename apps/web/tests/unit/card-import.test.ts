import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { db, type LocalCreditCard } from "@/db/schema";
import { useCardImportStore } from "@/stores/card-import";
import { useSessionStore } from "@/stores/session";
import { parseCardImportCSV } from "@/lib/card-import";

const CSV = [
  "data_proxima_parcela;valor_parcela;parcelas_total;parcelas_pagas;estabelecimento;categoria",
  "2026-11-20;131.84;21;13;RAFAEL PIAI;Outros",
  "2026-11-23;753.16;10;6;LOJA DA CASA;Moradia",
].join("\n");

const CARD: LocalCreditCard = {
  id: "card1",
  household: "h1",
  sync_id: "s-card1",
  account: "cardacc",
  bank: "Itaú",
  limit_cents: 0,
  currency: "BRL",
  closing_day: 4,
  due_day: 11,
  purchase_at_posting: false,
  uses_account_balance_for_invoice: false,
  active: true,
  order: 0,
  color: null,
  payment_account: null,
  owner: "indefinido",
  updated_by: null,
  deleted_at: null,
};

function category(id: string, name: string) {
  return {
    id,
    household: "h1",
    sync_id: `s-${id}`,
    name,
    kind: "saida" as const,
    group: "Casa",
    color: null,
    icon: null,
    system: false,
    active: true,
    order: 0,
    updated_by: null,
    deleted_at: null,
  };
}

describe("parseCardImportCSV", () => {
  it("lê datas ISO, valores com ponto e colunas de parcelas", () => {
    const rows = parseCardImportCSV(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      date: "2026-11-20",
      amountCents: 13184,
      installments: 21,
      paidInstallments: 13,
      merchant: "RAFAEL PIAI",
      categoryName: "Outros",
    });
    expect(rows[1]).toMatchObject({
      date: "2026-11-23",
      amountCents: 75316,
      installments: 10,
      paidInstallments: 6,
      merchant: "LOJA DA CASA",
      categoryName: "Moradia",
    });
    expect(rows[0]?.error).toBeUndefined();
  });

  it("aceita data pt-BR, vírgula decimal e colunas com outros nomes", () => {
    const rows = parseCardImportCSV(
      ["data;valor;parcelas;pagas;estabelecimento", "20/11/2026;1.234,56;12;2;GONCALES PNEUS"].join(
        "\n",
      ),
    );
    expect(rows[0]).toMatchObject({
      date: "2026-11-20",
      amountCents: 123456,
      installments: 12,
      paidInstallments: 2,
      merchant: "GONCALES PNEUS",
      categoryName: null,
    });
  });

  it("marca linhas inválidas sem derrubar as demais", () => {
    const rows = parseCardImportCSV(
      [
        "data;valor;parcelas;pagas",
        "31/02/2026;100,00;3;1",
        "20/11/2026;abc;3;1",
        "20/11/2026;100,00;3;3",
        "20/11/2026;100,00;3;1",
      ].join("\n"),
    );
    expect(rows.map((row) => row.error)).toEqual([
      "Data inválida",
      "Valor da parcela inválido",
      "Parcelas pagas inválidas",
      undefined,
    ]);
  });

  it("exige o cabeçalho mínimo", () => {
    expect(parseCardImportCSV("20/11/2026;100,00;3;1")).toEqual([]);
    expect(parseCardImportCSV("data;descricao\n20/11/2026;Compra")).toEqual([]);
  });
});

describe("useCardImportStore", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    await db.transactions.clear();
    await db.installments.clear();
    await db.invoices.clear();
    await db.categories.clear();
    await db.credit_cards.clear();
    await db.outbox.clear();
    useSessionStore().setHousehold("h1");
    await db.categories.bulkPut([
      category("cat-outros", "Outros"),
      category("cat-moradia", "Moradia"),
    ]);
    await db.credit_cards.put(CARD);
  });

  it("cria só as parcelas restantes, nas faturas certas e com categoria", async () => {
    const store = useCardImportStore();
    store.parse(CSV);
    const result = await store.confirm(CARD, null);
    expect(result).toEqual({ created: 2, skipped: 0, invalid: 0 });

    const transactions = await db.transactions.toArray();
    expect(transactions).toHaveLength(12);
    const installments = (await db.installments.toArray()).sort((a, b) => a.number - b.number);
    expect(installments.map((row) => `${row.number}/${row.total}`)).toContain("14/21");
    expect(installments.map((row) => `${row.number}/${row.total}`)).toContain("7/10");

    const rafael = transactions.find((tx) => tx.merchant === "RAFAEL PIAI");
    const loja = transactions.find((tx) => tx.merchant === "LOJA DA CASA");
    expect(rafael?.category).toBe("cat-outros");
    expect(loja?.category).toBe("cat-moradia");

    const invoices = await db.invoices.toArray();
    const first = invoices.filter((invoice) => invoice.reference_month === "2026-12");
    expect(first.reduce((sum, invoice) => sum + invoice.total_cents, 0)).toBe(88500);
  });

  it("não duplica ao reimportar o mesmo arquivo", async () => {
    const store = useCardImportStore();
    store.parse(CSV);
    await store.confirm(CARD, null);
    store.parse(CSV);
    const result = await store.confirm(CARD, null);
    expect(result).toEqual({ created: 0, skipped: 2, invalid: 0 });
    expect(await db.transactions.count()).toBe(12);
  });

  it("usa a categoria padrão quando a linha não traz categoria", async () => {
    const store = useCardImportStore();
    store.parse("data;valor;parcelas;pagas;estabelecimento\n2026-11-05;91.25;10;3;LOJA DA CASA");
    await store.confirm(CARD, "cat-moradia");
    const tx = (await db.transactions.toArray())[0];
    expect(tx?.category).toBe("cat-moradia");
  });
});
