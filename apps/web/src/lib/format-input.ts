import { parseAmountToCents } from "@cf/shared";

export { formatBRL } from "./format";

export function parseAmountInput(input: string): number | null {
  return parseAmountToCents(input);
}

/**
 * Campos monetários usam "modo centavos": digitar 1010 vira R$ 10,10.
 * Extrai só os dígitos (ignora vírgula/pontos) e interpreta como centavos.
 */
export function digitsToCents(value: string): number | null {
  const digits = value.replace(/\D/g, "").slice(0, 12);
  if (!digits) return null;
  return Number(digits);
}

/** Centavos → texto do input (ex.: 1010 → "10,10"). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}
