// The Combat Lab's build-time gate.
//
// The Lab exists to drive the production reducer with hand-picked packages, fixtures, seeds
// and command lists — which is exactly why it must not be reachable in a shipped build. A
// debug surface that can open in production is a debug surface someone will open in
// production, and this one can start fights and export state.
//
// So the gate is build-time and value-exact, in the same shape as the reference preview
// gate beside it: a query string cannot flip it, a truthy-ish value cannot flip it, and a
// missing environment cannot flip it. `import.meta.env` is replaced at build time, so a
// production bundle contains the constant `false` and the Lab tree is dropped entirely.

export const COMBAT_LAB_ENV = "VITE_ENABLE_COMBAT_LAB";

export function combatLabEnabled(environment = import.meta.env) {
  if (!environment || typeof environment !== "object") return false;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(environment, COMBAT_LAB_ENV);
    // Value-exact: "1", "yes", true and a present-but-empty variable are all off. The only
    // way in is the literal string, set at build time.
    if (!descriptor || !("value" in descriptor) || descriptor.value !== "true") return false;
  } catch {
    return false;
  }
  // Belt and braces: even with the flag set, a production build never opens it. This is what
  // makes "impossible to open in production through a query string alone" true rather than
  // dependent on nobody having set the variable in the release pipeline.
  try {
    const mode = Object.getOwnPropertyDescriptor(environment, "PROD");
    if (mode && "value" in mode && mode.value === true) return false;
  } catch {
    return false;
  }
  return true;
}

export const COMBAT_LAB_ENABLED = combatLabEnabled();
