import { parsePtBrDate } from "@cf/shared";

export interface CardImportRow {
  /** Data da primeira parcela restante. */
  date: string;
  /** Valor de cada parcela. */
  amountCents: number;
  installments: number;
  paidInstallments: number;
  merchant: string;
  description: string;
  categoryName: string | null;
  externalRef: string;
  error?: string;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) & 0xffffffff;
  }
  return `card-${(hash >>> 0).toString(16)}`;
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
}

function normalizeHeader(value: string): string {
  return value
    .replace(/^\ufeff/, "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findColumn(headers: string[], patterns: RegExp[]): number {
  for (const pattern of patterns) {
    const index = headers.findIndex((header) => pattern.test(header));
    if (index >= 0) return index;
  }
  return -1;
}

/** Aceita 131,84 / 131.84 / R$ 131,84 / 1.234,56 / 1,234.56. */
function parseAmount(value: string): number | null {
  const raw = value
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/^-/, "");
  let normalized = raw.replace(/[^\d.,]/g, "");
  if (!normalized) return null;
  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) normalized = normalized.replace(/\./g, "").replace(",", ".");
    else normalized = normalized.replace(/,/g, "");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(".", "").replace(",", ".");
  } else {
    const parts = normalized.split(".");
    const isDecimal = parts.length === 2 && (parts[1]?.length ?? 0) === 2;
    if (!isDecimal) normalized = normalized.replace(/\./g, "");
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || number <= 0) return null;
  return Math.round(number * 100);
}

function isValidISODate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function parsePositiveInt(value: string, fallback: number | null): number | null {
  const raw = value.trim();
  if (!raw && fallback !== null) return fallback;
  const number = Number.parseInt(raw, 10);
  return Number.isFinite(number) ? number : null;
}

/**
 * CSV de compras parceladas em andamento. Cabeçalho obrigatório com, no mínimo:
 * data da próxima parcela, valor da parcela, total de parcelas e já pagas.
 * Colunas opcionais: estabelecimento, descrição e categoria.
 */
export function parseCardImportCSV(text: string): CardImportRow[] {
  const lines = text
    .replace(/^\ufeff/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const first = lines[0] ?? "";
  const counts = [
    [";", (first.match(/;/g) ?? []).length],
    [",", (first.match(/,/g) ?? []).length],
    ["\t", (first.match(/\t/g) ?? []).length],
  ] as const;
  const delimiter = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ";";

  const headers = splitLine(first, delimiter).map(normalizeHeader);
  const dateIndex = findColumn(headers, [/^data/, /^date/]);
  const amountIndex = findColumn(headers, [
    /^valor_parcela$/,
    /^valor_da_parcela$/,
    /^valor$/,
    /^amount$/,
    /^parcela_valor$/,
  ]);
  const installmentsIndex = findColumn(headers, [
    /^parcelas_total$/,
    /^parcelas$/,
    /^total_parcelas$/,
    /^installments$/,
  ]);
  const paidIndex = findColumn(headers, [
    /^parcelas_pagas$/,
    /^pagas$/,
    /^paid_installments$/,
    /^paid$/,
  ]);
  const merchantIndex = findColumn(headers, [
    /estabelec/,
    /merchant/,
    /favorecid/,
    /payee/,
    /local/,
  ]);
  const descriptionIndex = findColumn(headers, [/descri/, /memo/]);
  const categoryIndex = findColumn(headers, [/categoria/, /category/]);

  if (dateIndex < 0 || amountIndex < 0 || installmentsIndex < 0) return [];

  const rows: CardImportRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const cells = splitLine(line, delimiter);
    const base = {
      date: "",
      amountCents: 0,
      installments: 0,
      paidInstallments: 0,
      merchant: merchantIndex >= 0 ? (cells[merchantIndex] ?? "").slice(0, 120) : "",
      description: descriptionIndex >= 0 ? (cells[descriptionIndex] ?? "").slice(0, 200) : "",
      categoryName: categoryIndex >= 0 ? (cells[categoryIndex] ?? "").trim() || null : null,
      externalRef: hashString(line),
    };

    const parsedDate = parsePtBrDate(cells[dateIndex] ?? "");
    const date = parsedDate && isValidISODate(parsedDate) ? parsedDate : null;
    const amountCents = parseAmount(cells[amountIndex] ?? "");
    const installments = parsePositiveInt(cells[installmentsIndex] ?? "", null);
    const paidInstallments = parsePositiveInt(paidIndex >= 0 ? (cells[paidIndex] ?? "") : "", 0);

    let error: string | undefined;
    if (!date) error = "Data inválida";
    else if (amountCents === null) error = "Valor da parcela inválido";
    else if (installments === null || !Number.isInteger(installments) || installments < 1) {
      error = "Total de parcelas inválido";
    } else if (
      paidInstallments === null ||
      !Number.isInteger(paidInstallments) ||
      paidInstallments < 0 ||
      paidInstallments >= installments
    ) {
      error = "Parcelas pagas inválidas";
    }

    rows.push({
      ...base,
      date: date ?? "",
      amountCents: amountCents ?? 0,
      installments: installments ?? 0,
      paidInstallments: paidInstallments ?? 0,
      error,
    });
  }
  return rows;
}
