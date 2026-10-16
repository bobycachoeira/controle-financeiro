import { describe, expect, it } from "vitest";

/**
 * Guarda de contraste WCAG 2.2 AA para os tokens de cor do app
 * (`src/assets/index.css`). Se um token mudar e derrubar um par usado como
 * texto/fundo, o teste falha. Pares de texto pequeno exigem >= 4.5; ícones e
 * textos grandes exigem >= 3.
 */

type Hsl = [number, number, number];

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const saturation = s / 100;
  const lightness = l / 100;
  const k = (n: number): number => (n + h / 30) % 12;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const f = (n: number): number =>
    lightness - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number): number =>
    value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: Hsl, b: Hsl): number {
  const la = relativeLuminance(hslToRgb(...a));
  const lb = relativeLuminance(hslToRgb(...b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

const LIGHT = {
  background: [165, 32, 96] as Hsl,
  foreground: [200, 30, 14] as Hsl,
  card: [165, 40, 99] as Hsl,
  muted: [168, 22, 92] as Hsl,
  mutedForeground: [200, 14, 40] as Hsl,
  primary: [170, 62, 30] as Hsl,
  primaryForeground: [160, 40, 98] as Hsl,
  leaf: [152, 48, 34] as Hsl,
  destructive: [358, 68, 50] as Hsl,
  sun: [45, 92, 60] as Hsl,
  accentForeground: [200, 60, 12] as Hsl,
};

const DARK = {
  background: [200, 26, 8] as Hsl,
  foreground: [168, 22, 94] as Hsl,
  card: [200, 22, 12] as Hsl,
  muted: [200, 14, 17] as Hsl,
  mutedForeground: [168, 12, 66] as Hsl,
  primary: [170, 58, 48] as Hsl,
  primaryForeground: [200, 40, 8] as Hsl,
  leaf: [152, 52, 56] as Hsl,
  destructive: [358, 68, 62] as Hsl,
};

describe("contraste dos tokens (WCAG AA)", () => {
  const aaPairs: Array<[string, Hsl, Hsl]> = [
    ["texto no fundo (claro)", LIGHT.foreground, LIGHT.background],
    ["texto no card (claro)", LIGHT.foreground, LIGHT.card],
    ["texto secundário no card (claro)", LIGHT.mutedForeground, LIGHT.card],
    ["texto secundário no muted (claro)", LIGHT.mutedForeground, LIGHT.muted],
    ["botão primário (claro)", LIGHT.primaryForeground, LIGHT.primary],
    ["receita (leaf) no card (claro)", LIGHT.leaf, LIGHT.card],
    ["erro no card (claro)", LIGHT.destructive, LIGHT.card],
    ["texto do sol no acccent (claro)", LIGHT.accentForeground, LIGHT.sun],
    ["texto no fundo (escuro)", DARK.foreground, DARK.background],
    ["texto no card (escuro)", DARK.foreground, DARK.card],
    ["texto secundário no muted (escuro)", DARK.mutedForeground, DARK.muted],
    ["botão primário (escuro)", DARK.primaryForeground, DARK.primary],
    ["receita (leaf) no card (escuro)", DARK.leaf, DARK.card],
    ["erro no card (escuro)", DARK.destructive, DARK.card],
  ];

  for (const [label, fg, bg] of aaPairs) {
    it(`${label}: >= 4.5`, () => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
