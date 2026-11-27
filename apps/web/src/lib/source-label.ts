import type { LocalAccount, LocalCreditCard, LocalTransaction } from "@/db/schema";

export function buildSourceName(
  accounts: readonly LocalAccount[],
  cards: readonly LocalCreditCard[],
): (tx: Pick<LocalTransaction, "account" | "credit_card">) => string {
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]));
  const cardNames = new Map(cards.map((card) => [card.id, (card.bank ?? "").trim() || "Cartão"]));
  return (tx) => {
    if (tx.credit_card) {
      const cardName = cardNames.get(tx.credit_card);
      if (cardName) return cardName;
    }
    return accountNames.get(tx.account) ?? "";
  };
}

export function accountDisplayName(
  account: LocalAccount,
  cards: readonly LocalCreditCard[],
): string {
  if (account.type !== "cartao_credito") return account.name;
  const card = cards.find((item) => item.account === account.id);
  return (card?.bank ?? "").trim() || account.name;
}
