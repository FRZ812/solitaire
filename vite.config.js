import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Solitaire is now web-only — the single-file artifact build was retired
// once the map moved into Supabase (the artifact pane can't reach the
// network reliably to fetch it). The `$api` / `$campaigns` / `$auth`
// aliases that switched between artifact and web variants are gone too;
// the web modules are imported directly now.
//
// GitHub Pages serves the deployed site under https://<user>.github.io/solitaire/,
// so the PRODUCTION build needs its asset URLs scoped to that subpath.
// Override with SOLITAIRE_BASE if the site moves (custom domain, different repo
// name, etc.).
//
// IMPORTANT: in `dev` (vite serve) we serve at `/` even though the prod
// build is at `/solitaire/`. This keeps the dev URL clean —
// `http://localhost:5173/` rather than `http://localhost:5173/solitaire/` —
// which makes the Supabase OAuth Redirect URLs allowlist simpler to manage
// (one entry per port, no path needed) and avoids the OAuth-bounce-to-prod
// trap where an un-listed dev path silently falls back to the Site URL.
const WEB_BASE = process.env.SOLITAIRE_BASE || "/solitaire/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? WEB_BASE : "/",
  build: {
    target: "es2020",
  },
}));
