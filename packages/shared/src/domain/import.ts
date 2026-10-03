import { pad2 } from "./dates";

export type ImportNature = "entrada" | "saida";

export interface ParsedImportRow {
  date: string;
  amountCents: number;
  description: string;
  nature: ImportNature;
  externalRef: string;
  error?: string;
}

export function detectFormat(text: string): "csv" | "ofx" | null {
  const trimmed = text.trim();
  if (/<OFX>/i.test(trimmed) || /<STMTTRN>/i.test(trimmed)) return "ofx";
  if (/;/.test(trimmed) || /,/.test(trimmed) || /\t/.test(trimmed)) return "csv";
  return null;
}

function hashString(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) & 0xffffffff;
  }
  return `csv-${(hash >>> 0).toString(16)}`;
}

export function parsePtBrDate(value: string): string | null {
  const raw = value.trim().split(/[ T]/)[0] ?? "";
  let match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${pad2(Number(match[2]))}-${pad2(Number(match[1]))}`;
  match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return raw;
  return null;
}

function parseAmount(value: string): { cents: number; nature: ImportNature } | null {
  let raw = value.trim();
  let negative = false;
  if (/^\(.*\)$/.test(raw)) {
    negative = true;
    raw = raw.slice(1, -1);
  }
  if (raw.startsWith("-")) {
    negative = true;
    raw = raw.slice(1);
  }
  let normalized = raw.replace(/[^\d.,]/g, "");
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    const parts = normalized.split(".");
    const isDecimal = parts.length === 2 && (parts[1]?.length ?? 0) === 2;
    if (!isDecimal) normalized = normalized.replace(/\./g, "");
  }
  const number = Number(normalized);
  if (!Number.isFinite(number) || normalized === "") return null;
  const cents = Math.round(number * 100);
  return { cents: Math.abs(cents), nature: negative ? "saida" : "entrada" };
}

function splitCsvLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((part) => part.trim().replace(/^"|"$/g, ""));
}

export function parseCSV(text: string): ParsedImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) return [];

  const delimiter = (lines[0]?.match(/;/g)?.length ?? 0) >= (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitCsvLine(lines[0] ?? "", delimiter).map((cell) => cell.toLowerCase());
  const hasHeader = header.some((cell) => /data|date|valor|amount|descri|memo/.test(cell));
  const dateIndex = hasHeader ? header.findIndex((cell) => /data|date/.test(cell)) : 0;
  const amountIndex = hasHeader ? header.findIndex((cell) => /valor|amount/.test(cell)) : 1;
  const descIndex = hasHeader ? header.findIndex((cell) => /descri|memo|hist/.test(cell)) : 2;

  const rows: ParsedImportRow[] = [];
  const start = hasHeader ? 1 : 0;
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const cells = splitCsvLine(line, delimiter);
    const externalRef = hashString(line);
    const date = parsePtBrDate(cells[dateIndex] ?? "");
    const amount = parseAmount(cells[amountIndex] ?? "");
    if (!date || !amount) {
      rows.push({
        date: date ?? "",
        amountCents: 0,
        description: cells[descIndex] ?? "",
        nature: "saida",
        externalRef,
        error: "Linha inválida",
      });
      continue;
    }
    rows.push({
      date,
      amountCents: amount.cents,
      description: (cells[descIndex] ?? "").slice(0, 200),
      nature: amount.nature,
      externalRef,
    });
  }
  return rows;
}

function tagValue(block: string, tag: string): string {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? match[1]!.trim() : "";
}

export function parseOFX(text: string): ParsedImportRow[] {
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi) ?? [];
  const rows: ParsedImportRow[] = [];
  for (const block of blocks) {
    const rawDate = tagValue(block, "DTPOSTED");
    const rawAmount = tagValue(block, "TRNAMT");
    const memo = tagValue(block, "MEMO") || tagValue(block, "NAME");
    const fitId = tagValue(block, "FITID");
    const type = tagValue(block, "TRNTYPE").toUpperCase();
    const dataMatch = rawDate.match(/^(\d{4})(\d{2})(\d{2})/);
    const date = dataMatch ? `${dataMatch[1]}-${dataMatch[2]}-${dataMatch[3]}` : "";
    const amount = parseAmount(rawAmount);
    const nature: ImportNature = type === "CREDIT" || (amount && amount.nature === "entrada") ? "entrada" : "saida";
    if (!date || !amount) {
      rows.push({
        date,
        amountCents: 0,
        description: memo,
        nature: "saida",
        externalRef: fitId || hashString(block),
        error: "Transação inválida",
      });
      continue;
    }
    rows.push({
      date,
      amountCents: amount.cents,
      description: memo.slice(0, 200),
      nature,
      externalRef: fitId || hashString(block),
    });
  }
  return rows;
}

export function parseStatement(text: string): ParsedImportRow[] {
  const format = detectFormat(text);
  if (format === "ofx") return parseOFX(text);
  if (format === "csv") return parseCSV(text);
  return [];
}
