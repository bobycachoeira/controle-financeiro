export const ROLES = ["owner", "partner", "teen", "child", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ADULT_ROLES: readonly Role[] = ["owner", "partner"];
export const INVITE_ROLES: readonly Role[] = ["partner", "teen", "child", "viewer"];

export const ACCOUNT_TYPES = [
  "corrente",
  "poupanca",
  "carteira",
  "cartao_credito",
  "investimento",
  "outros",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const TRANSACTION_TYPES = ["receita", "despesa", "transferencia"] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUS = ["pago", "a_pagar"] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUS)[number];

export const ATTRIBUTIONS = ["meu", "dela", "ambos", "indefinido"] as const;
export type Attribution = (typeof ATTRIBUTIONS)[number];

export const BILL_TYPES = ["fixa", "variavel"] as const;
export type BillType = (typeof BILL_TYPES)[number];

export const BILL_NATURES = ["entrada", "saida"] as const;
export type BillNature = (typeof BILL_NATURES)[number];

export const BILL_PERIODICITIES = [
  "unica",
  "mensal",
  "bimestral",
  "trimestral",
  "anual",
  "personalizada",
] as const;
export type BillPeriodicity = (typeof BILL_PERIODICITIES)[number];

export const BILL_STATUS = ["pendente", "pago", "cancelado"] as const;
export type BillStatus = (typeof BILL_STATUS)[number];

export const CATEGORY_KINDS = ["entrada", "saida"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const INVOICE_STATUS = ["aberta", "fechada", "paga", "vencida"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

export const MEMBER_INVITE_STATUS = ["pending", "accepted"] as const;
export type MemberInviteStatus = (typeof MEMBER_INVITE_STATUS)[number];

export const CURRENCY = "BRL" as const;
