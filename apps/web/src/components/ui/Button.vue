<script setup lang="ts">
import { computed } from "vue";
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "outline" | "ghost" | "destructive" | "sun";
type Size = "sm" | "md" | "lg" | "icon";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    loading?: boolean;
    class?: string;
  }>(),
  { variant: "default", size: "md", type: "button", disabled: false, loading: false, class: "" },
);

const variants: Record<Variant, string> = {
  default:
    "bg-primary text-primary-foreground shadow-lift hover:brightness-105 active:brightness-95",
  secondary: "bg-secondary text-secondary-foreground hover:brightness-105",
  outline: "border-2 border-border bg-card text-foreground hover:bg-muted",
  ghost: "text-foreground/80 hover:bg-muted hover:text-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:brightness-105",
  sun: "bg-sun text-accent-foreground shadow-lift hover:brightness-105",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.95rem]",
  lg: "h-12 px-7 text-base",
  icon: "h-11 w-11",
};

const classes = computed(() =>
  cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-full font-extrabold tracking-tight transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
    variants[props.variant],
    sizes[props.size],
    props.class,
  ),
);
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <span
      v-if="loading"
      class="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
    <slot />
  </button>
</template>
