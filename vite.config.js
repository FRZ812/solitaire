import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// SOLITAIRE_MODE picks the build target. Default `artifact` keeps the historic
// behaviour: a single dist/index.html for pasting into a Claude artifact.
// `web` produces a normal multi-file Vite build that talks to Supabase.
const MODE = process.env.SOLITAIRE_MODE === "web" ? "web" : "artifact";

// GitHub Pages serves the deployed site under https://<user>.github.io/solitaire/,
// so the PRODUCTION web build needs its asset URLs scoped to that subpath.
// Override with SOLITAIRE_BASE if the site moves (custom domain, different repo
// name, etc.). Artifact mode inlines everything, so its base is irrelevant.
//
// IMPORTANT: in `dev:web` (vite serve in web mode) we serve at `/` even though
// the prod build is at `/solitaire/`. This keeps the dev URL clean —
// `http://localhost:5174/` rather than `http://localhost:5174/solitaire/` —
// which makes the Supabase OAuth Redirect URLs allowlist simpler to manage
// (one entry per port, no path needed) and avoids the OAuth-bounce-to-prod
// trap where an un-listed dev path silently falls back to the Site URL.
const WEB_BASE = process.env.SOLITAIRE_BASE || "/solitaire/";

export default defineConfig(({ command }) => ({
  plugins: [react(), ...(MODE === "artifact" ? [viteSingleFile()] : [])],
  base: MODE === "web" && command === "build" ? WEB_BASE : "/",
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
}));
