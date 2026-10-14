import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
      },
      manifest: {
        name: "Controle Financeiro Familiar",
        short_name: "Finanças",
        description: "Controle financeiro familiar offline-first",
        lang: "pt-BR",
        theme_color: "#208877",
        background_color: "#f4f8f6",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/pwa-192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Novo lançamento",
            short_name: "Novo",
            description: "Registrar um gasto ou receita",
            url: "/?new=1",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Lançamentos",
            short_name: "Lançamentos",
            description: "Ver e buscar lançamentos",
            url: "/transactions",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
          {
            name: "Calendário",
            short_name: "Calendário",
            description: "O que vence nos próximos dias",
            url: "/calendar",
            icons: [{ src: "/pwa-192.png", sizes: "192x192" }],
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "@cf/shared": fileURLToPath(new URL("../../packages/shared/src/index.ts", import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
