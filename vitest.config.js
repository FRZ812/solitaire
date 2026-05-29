import { defineConfig } from "vitest/config";

// Engine-only test config. The pure game logic in src/engine transitively
// imports supabase-client.js (via world.js → handcrafted-map.js), whose
// module-level createClient() reads import.meta.env. We inject dummy values
// here so the import chain resolves headlessly without depending on the real
// committed .env — createClient does no network I/O at construction, so a
// throwaway URL/key is enough to let the engine modules load under `node`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{js,jsx}"],
    env: {
      VITE_SUPABASE_URL: "http://localhost:54321",
      VITE_SUPABASE_ANON_KEY: "test-anon-key",
    },
  },
});
