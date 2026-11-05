import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon-192.png", "icon-512.png", "apple-touch-icon.png"],
      manifest: {
        name: "Trainingsplan",
        short_name: "Training",
        description: "Dein Training. Dein Fortschritt.",
        lang: "de-CH",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#0A1628",
        theme_color: "#0A1628",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/legacy\//],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          framework: ["react", "react-dom", "react-router-dom"],
          storage: ["dexie", "dexie-react-hooks"],
          validation: ["zod"],
        },
      },
    },
  },
  test: { environment: "node", setupFiles: ["./src/test-setup.ts"] },
});
