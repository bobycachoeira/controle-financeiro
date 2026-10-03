import type { Component } from "vue";
import {
  Baby,
  Banknote,
  CalendarClock,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Cat,
  Coins,
  Coffee,
  CreditCard,
  Dog,
  Droplet,
  Dumbbell,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  Heart,
  Home,
  KeyRound,
  Landmark,
  Laptop,
  Music,
  Package,
  PiggyBank,
  Pill,
  Plane,
  PlusCircle,
  Receipt,
  Repeat,
  Shirt,
  ShoppingCart,
  School,
  Sparkles,
  Tag,
  Tv,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Zap,
} from "lucide-vue-next";

/** Nomes amigáveis -> componente de ícone (lucide). */
export const ICON_REGISTRY: Record<string, Component> = {
  wallet: Wallet,
  laptop: Laptop,
  "plus-circle": PlusCircle,
  home: Home,
  key: KeyRound,
  building: Landmark,
  zap: Zap,
  droplet: Droplet,
  wifi: Wifi,
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  "utensils-crossed": UtensilsCrossed,
  car: Car,
  fuel: Fuel,
  heart: Heart,
  pill: Pill,
  "graduation-cap": GraduationCap,
  "gamepad-2": Gamepad2,
  shirt: Shirt,
  repeat: Repeat,
  tag: Tag,
  cat: Cat,
  dog: Dog,
  baby: Baby,
  school: School,
  book: BookOpen,
  briefcase: Briefcase,
  banknote: Banknote,
  coins: Coins,
  "hand-coins": HandCoins,
  "piggy-bank": PiggyBank,
  receipt: Receipt,
  "credit-card": CreditCard,
  "calendar-clock": CalendarClock,
  tv: Tv,
  music: Music,
  dumbbell: Dumbbell,
  coffee: Coffee,
  bus: Bus,
  bike: Bike,
  plane: Plane,
  gift: Gift,
  package: Package,
  sparkles: Sparkles,
};

export const ICON_NAMES = Object.keys(ICON_REGISTRY);

export function resolveIcon(name?: string | null): Component {
  if (name && ICON_REGISTRY[name]) return ICON_REGISTRY[name]!;
  return Tag;
}

const ACCOUNT_TYPE_ICONS: Record<string, string> = {
  corrente: "wallet",
  poupanca: "piggy-bank",
  carteira: "coins",
  cartao_credito: "credit-card",
  investimento: "banknote",
  outros: "package",
};

export function accountIconName(type: string, explicit?: string | null): string {
  return explicit || ACCOUNT_TYPE_ICONS[type] || "wallet";
}

/** Paleta quente e coerente com a identidade. */
export const CHIP_COLORS = [
  "#E4572E", // coral
  "#F2A93B", // sol
  "#3F9A6A", // folha
  "#3B82B6", // céu
  "#B0477E", // ameixa
  "#8A6FD1", // lavanda
  "#D1622F", // terracota
  "#1F7A73", // petróleo
];

export function colorForKey(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) >>> 0;
  }
  return CHIP_COLORS[hash % CHIP_COLORS.length]!;
}
