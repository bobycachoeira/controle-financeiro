<script setup lang="ts">
import { cn } from "@/lib/utils";

type Variant = "default" | "secondary" | "success" | "warning" | "destructive" | "outline";

const props = withDefaults(defineProps<{ variant?: Variant; class?: string }>(), {
  variant: "default",
  class: "",
});

const variants: Record<Variant, string> = {
  default: "bg-primary/12 text-primary",
  secondary: "bg-secondary text-secondary-foreground",
  success: "bg-leaf/15 text-leaf",
  warning: "bg-sun/25 text-accent-foreground",
  destructive: "bg-destructive/12 text-destructive",
  outline: "border-2 border-border text-muted-foreground",
};
</script>

<template>
  <span
    :class="
      cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-wide',
        variants[props.variant],
        props.class,
      )
    "
  >
    <slot />
  </span>
</template>
