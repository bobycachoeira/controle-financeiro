export interface TransferInput {
  id: string;
  household: string;
  source_account: string;
  destination_account: string;
  amount_cents: number;
  date: string;
  description?: string;
}

export interface TransferValidation {
  valid: boolean;
  error?: "same_account" | "invalid_amount";
}

export function validateTransfer(input: {
  source_account: string;
  destination_account: string;
  amount_cents: number;
}): TransferValidation {
  if (input.source_account === input.destination_account) {
    return { valid: false, error: "same_account" };
  }
  if (!Number.isInteger(input.amount_cents) || input.amount_cents <= 0) {
    return { valid: false, error: "invalid_amount" };
  }
  return { valid: true };
}

export interface GeneratedTransferTransaction {
  account: string;
  type: "transferencia";
  status: "pago";
  amount_cents: number;
  date: string;
  description: string;
  transfer: string;
}

export function buildTransferTransactions(
  input: TransferInput,
): GeneratedTransferTransaction[] {
  const description = input.description ?? "Transferência";
  return [
    {
      account: input.source_account,
      type: "transferencia",
      status: "pago",
      amount_cents: -input.amount_cents,
      date: input.date,
      description,
      transfer: input.id,
    },
    {
      account: input.destination_account,
      type: "transferencia",
      status: "pago",
      amount_cents: input.amount_cents,
      date: input.date,
      description,
      transfer: input.id,
    },
  ];
}
