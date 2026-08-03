// Runs a sim script through Vite's module pipeline.
//
// The sims import the real engine, and the engine's world chain reaches
// `supabase-client.js`, which reads `import.meta.env` — a Vite construct that
// bare Node has no notion of, so `node scripts/whatever-sim.mjs` dies on the
// import rather than on anything the sim did. Loading through Vite gives the
// same environment the app and the test suite already run in.
//
// Run: node scripts/run-sim.mjs <sim> [args…]
//   e.g. node scripts/run-sim.mjs travel-evasion-sim 20000

import { createServer } from "vite";
import { resolve } from "node:path";

const [name, ...rest] = process.argv.slice(2);
if (!name) {
  console.error("usage: node scripts/run-sim.mjs <sim-name> [args…]");
  process.exit(2);
}

const file = resolve(process.cwd(), "scripts", name.endsWith(".mjs") ? name : `${name}.mjs`);
// The sims read their own tuning arguments off argv, so they have to see them
// where they would have been had Node run them directly.
process.argv = [process.argv[0], file, ...rest];

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "warn",
  // The same throwaway credentials vitest.config.js injects, for the same
  // reason: `createClient` does no network I/O at construction, so this is
  // only enough to let the world chain finish importing.
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("http://localhost:54321"),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
  },
});
try {
  await server.ssrLoadModule(file);
} finally {
  await server.close();
}
