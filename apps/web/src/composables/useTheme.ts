import { readonly, ref } from "vue";

const STORAGE_KEY = "cf.theme";
export type Theme = "light" | "dark";

const THEME_COLORS: Record<Theme, string> = {
  light: "#fbf3e7",
  dark: "#14110d",
};

function initialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const theme = ref<Theme>(initialTheme());

export function applyTheme(value: Theme = theme.value): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", value === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_COLORS[value]);
}

export function useTheme() {
  function setTheme(value: Theme): void {
    theme.value = value;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // ignora storage indisponível
    }
    applyTheme(value);
  }

  function toggle(): void {
    setTheme(theme.value === "dark" ? "light" : "dark");
  }

  return { theme: readonly(theme), setTheme, toggle };
}
