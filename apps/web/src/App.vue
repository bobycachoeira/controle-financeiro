<script setup lang="ts">
import { RouterView } from "vue-router";
import Toaster from "@/components/ui/Toaster.vue";
</script>

<template>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
  >
    Pular para o conteúdo
  </a>
  <RouterView />
  <Toaster />
</template>
