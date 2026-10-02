<script setup lang="ts">
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const props = withDefaults(defineProps<{ variant?: Variant; class?: string }>(), {
  variant: "default",
  class: "",
});

const variants: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
  outline: "border border-input text-foreground",
};
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[props.variant],
        props.class,
      )
    "
  >
    <slot />
  </span>
</template>
