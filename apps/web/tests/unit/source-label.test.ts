import { describe, expect, it } from "vitest";
import type { LocalAccount, LocalCreditCard } from "@/db/schema";
import { accountDisplayName, buildSourceName } from "@/lib/source-label";

const account: LocalAccount = {
  id: "acc1",
  household: "h1",
  sync_id: "s-acc1",
  name: "Cartão Bçack Itau personalite",
  type: "cartao_credito",
  currency: "BRL",
  initial_balance_cents: 0,
  include_in_total: false,
  active: true,
  order: 0,
  color: null,
  icon: null,
  owner: "indefinido",
  updated_by: null,
  deleted_at: null,
};

const checking: LocalAccount = {
  ...account,
  id: "acc2",
  sync_id: "s-acc2",
  name: "Conta Corrente",
  type: "corrente",
  include_in_total: true,
};

const card: LocalCreditCard = {
  id: "card1",
  household: "h1",
  sync_id: "s-card1",
  account: "acc1",
  bank: "Black Itau personalite",
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

describe("buildSourceName", () => {
  const sourceName = buildSourceName([account, checking], [card]);

  it("usa o nome do cartão para lançamentos no cartão", () => {
    expect(sourceName({ account: "acc1", credit_card: "card1" })).toBe("Black Itau personalite");
  });

  it("usa o nome da conta para lançamentos sem cartão", () => {
    expect(sourceName({ account: "acc2", credit_card: null })).toBe("Conta Corrente");
  });

  it("cai no nome da conta quando o cartão não é encontrado", () => {
    expect(sourceName({ account: "acc1", credit_card: "card-inexistente" })).toBe(
      "Cartão Bçack Itau personalite",
    );
  });

  it("usa 'Cartão' quando o cartão não tem banco", () => {
    const semBanco = buildSourceName([account], [{ ...card, bank: null }]);
    expect(semBanco({ account: "acc1", credit_card: "card1" })).toBe("Cartão");
  });
});

describe("accountDisplayName", () => {
  it("usa o nome do cartão para a conta interna do cartão", () => {
    expect(accountDisplayName(account, [card])).toBe("Black Itau personalite");
  });

  it("mantém o nome das contas normais", () => {
    expect(accountDisplayName(checking, [card])).toBe("Conta Corrente");
  });

  it("cai no nome da conta quando o cartão não é encontrado", () => {
    expect(accountDisplayName(account, [])).toBe("Cartão Bçack Itau personalite");
  });
});
