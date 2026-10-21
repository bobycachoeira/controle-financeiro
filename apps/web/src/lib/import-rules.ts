export interface ImportRule {
  pattern: string;
  category: string;
}

export function parseImportRules(value: unknown): ImportRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { pattern: string; category: string } =>
        Boolean(
          item &&
            typeof item === "object" &&
            typeof (item as { pattern?: unknown }).pattern === "string" &&
            typeof (item as { category?: unknown }).category === "string",
        ),
    )
    .map((item) => ({ pattern: item.pattern.trim(), category: item.category }))
    .filter((item) => item.pattern.length > 0);
}

/** Primeira regra cujo texto aparece na descrição (case-insensitive). */
export function matchImportRule(
  description: string,
  rules: readonly ImportRule[],
): ImportRule | null {
  const text = description.toLowerCase();
  for (const rule of rules) {
    const pattern = rule.pattern.trim().toLowerCase();
    if (pattern && text.includes(pattern)) return rule;
  }
  return null;
}

/** Regras do formulário: estabelecimento tem prioridade sobre a descrição. */
export function matchTransactionRule(
  merchant: string,
  description: string,
  rules: readonly ImportRule[],
): ImportRule | null {
  return matchImportRule(merchant, rules) ?? matchImportRule(description, rules);
}
