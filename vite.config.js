import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// SOLITAIRE_MODE picks the build target. Default `artifact` keeps the historic
// behaviour: a single dist/index.html for pasting into a Claude artifact.
// `web` produces a normal multi-file Vite build that talks to Supabase.
const MODE = process.env.SOLITAIRE_MODE === "web" ? "web" : "artifact";

export default defineConfig({
  plugins: [react(), ...(MODE === "artifact" ? [viteSingleFile()] : [])],
  define: {
    __SOLITAIRE_MODE__: JSON.stringify(MODE),
  },
  resolve: {
    alias: {
      $api: MODE === "web"
        ? "/src/engine/api-supabase.js"
        : "/src/engine/api-anthropic.js",
      $campaigns: MODE === "web"
        ? "/src/engine/campaigns-supabase.js"
        : "/src/engine/campaigns-local.js",
      $auth: MODE === "web"
        ? "/src/engine/auth-supabase.js"
        : "/src/engine/auth-noop.js",
    },
  },
  build: {
    target: "es2020",
    ...(MODE === "artifact"
      ? {
          cssCodeSplit: false,
          assetsInlineLimit: 100_000_000,
          chunkSizeWarningLimit: 100_000_000,
          rollupOptions: {
            output: {
              inlineDynamicImports: true,
              manualChunks: undefined,
            },
          },
        }
      : {}),
  },
});
