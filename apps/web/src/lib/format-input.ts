import { parseAmountToCents } from "@cf/shared";

export { formatBRL } from "./format";

export function parseAmountInput(input: string): number | null {
  return parseAmountToCents(input);
}
