export interface CommonCurrency {
  code: string;
  label: string;
}

export const COMMON_CURRENCIES: readonly CommonCurrency[] = [
  { code: "USD", label: "Dólar americano" },
  { code: "EUR", label: "Euro" },
  { code: "GBP", label: "Libra esterlina" },
  { code: "ARS", label: "Peso argentino" },
  { code: "CAD", label: "Dólar canadense" },
  { code: "AUD", label: "Dólar australiano" },
  { code: "JPY", label: "Iene japonês" },
  { code: "CHF", label: "Franco suíço" },
  { code: "CNY", label: "Yuan chinês" },
  { code: "PYG", label: "Guarani paraguaio" },
  { code: "UYU", label: "Peso uruguaio" },
];
