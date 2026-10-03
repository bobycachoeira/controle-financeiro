export interface AttributionOption {
  key: string;
  label: string;
}

export const DEFAULT_ATTRIBUTION_OPTIONS: AttributionOption[] = [
  { key: "meu", label: "Eu" },
  { key: "dela", label: "Ela" },
];

export const SHARED_ATTRIBUTION = "ambos";
export const UNDEFINED_ATTRIBUTION = "indefinido";

interface HouseholdSettingsLike {
  attribution_options?: unknown;
}

/** Lê as pessoas configuradas no household (com fallback para Eu/Ela). */
export function attributionOptions(settings: unknown): AttributionOption[] {
  const parsed = (settings ?? {}) as HouseholdSettingsLike;
  const list = parsed.attribution_options;
  if (Array.isArray(list)) {
    const options = list
      .filter((item): item is AttributionOption => {
        return Boolean(item && typeof item === "object" && "key" in item && "label" in item);
      })
      .map((item) => ({ key: String(item.key), label: String(item.label) }))
      .filter((item) => item.key && item.label);
    if (options.length > 0) return options;
  }
  return DEFAULT_ATTRIBUTION_OPTIONS;
}

export function attributionLabel(key: string, options: readonly AttributionOption[]): string {
  if (key === SHARED_ATTRIBUTION) return "Ambos";
  if (key === UNDEFINED_ATTRIBUTION) return "Não definido";
  return options.find((option) => option.key === key)?.label ?? key;
}
