export const SYNC_OPERATIONS = ["create", "update", "delete"] as const;
export type SyncOperationType = (typeof SYNC_OPERATIONS)[number];

export const SYNC_RESULTS = ["applied", "conflict", "ignored", "error"] as const;
export type SyncResultStatus = (typeof SYNC_RESULTS)[number];

export const SYNC_ENTITY_NAMES = [
  "households",
  "household_members",
  "accounts",
  "credit_cards",
  "categories",
  "transactions",
  "installments",
  "invoices",
  "transfers",
  "bills",
  "recurrences",
  "budgets",
  "exchange_rates",
] as const;
export type SyncEntityName = (typeof SYNC_ENTITY_NAMES)[number];

export const STEP_UP_ACTIONS = [
  "2fa.setup",
  "2fa.disable",
  "invite.create",
  "member.role.update",
  "member.remove",
  "category.system.delete",
] as const;
export type StepUpAction = (typeof STEP_UP_ACTIONS)[number];
