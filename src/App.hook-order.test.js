import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = fileURLToPath(new URL("./App.jsx", import.meta.url));
const mainPath = fileURLToPath(new URL("./main.jsx", import.meta.url));

describe("Solitaire hook order", () => {
  it("initializes the chat-context memo before auth and campaign early returns", () => {
    const source = fs.readFileSync(appPath, "utf8");
    const authGate = source.indexOf("if (!authChecked)");
    const contextMemo = source.indexOf("const contextPreview = useMemo");

    expect(authGate).toBeGreaterThan(-1);
    expect(
      contextMemo === -1 || contextMemo < authGate,
      "hooks introduced for chat context must run before every early return",
    ).toBe(true);
  });

  it("isolates the legacy HUD while reference gameplay owns the viewport", () => {
    const source = fs.readFileSync(appPath, "utf8");
    const rootSource = fs.readFileSync(mainPath, "utf8");

    expect(source).toContain("const gameSurfaceBlocked = referenceGameplayOpen || showCreationHub;");
    expect(source).toContain('inert={gameSurfaceBlocked ? "" : undefined}');
    expect(source).toContain("aria-hidden={gameSurfaceBlocked ? true : undefined}");
    expect(source).toContain('[data-app-global-surfaces]');
    expect(source).toContain("gameShell.children");
    expect(source).toContain("document.body.children");
    expect(source).toContain("new MutationObserver");
    expect(source).toContain("observer.observe(gameShell, { childList: true })");
    expect(source).toContain("observer.observe(document.body, { childList: true })");
    expect(rootSource).toContain("data-app-global-surfaces");
  });

  it("reports reference transition failures inside the owning modal", () => {
    const source = fs.readFileSync(appPath, "utf8");

    expect(source).toContain("referenceGameplayFeedback");
    expect(source).toContain(
      "feedback={referenceGameplayFeedback || campaignError || referencePersistenceFeedback}",
    );
  });

  it("keeps reference gameplay behind the disabled-by-default preview gate", () => {
    const source = fs.readFileSync(appPath, "utf8");

    expect(source).toContain("REFERENCE_GAMEPLAY_PREVIEW_ENABLED");
    expect(source).toContain("REFERENCE_GAMEPLAY_PREVIEW_ENABLED && referenceRun");
    expect(source).toContain("Developer sandbox");
    expect(source).toContain("not the production combat path");
  });

  it("surfaces invalid reference saves instead of presenting them as a fresh start", () => {
    const source = fs.readFileSync(appPath, "utf8");

    expect(source).toContain("Reference trial save unavailable");
    expect(source).toContain("Replace invalid save");
    expect(source).toContain("referenceGameplay.reason");
  });

  it("keeps the retired progression handler inert for archetype characters", () => {
    const source = fs.readFileSync(appPath, "utf8");
    const handler = source.indexOf("function handleProgressionChoice");
    const guard = source.indexOf(
      'if (current.character?.progressionModel === "tow-archetype") return current;',
      handler,
    );
    const pendingLookup = source.indexOf("pendingProgressionChoices(current.character)", handler);

    expect(handler).toBeGreaterThan(-1);
    expect(guard).toBeGreaterThan(handler);
    expect(guard).toBeLessThan(pendingLookup);
  });
});
