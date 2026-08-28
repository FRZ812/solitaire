import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tests exercise browser modules without contacting Supabase. Public-shaped
// placeholders keep module initialization deterministic in CI, while production
// builds still receive their real browser identifiers from the deployment job.
process.env.VITE_SUPABASE_URL ||= "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "public-test-key";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{js,jsx,ts,tsx}"],
  },
});
