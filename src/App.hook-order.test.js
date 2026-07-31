import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appPath = fileURLToPath(new URL("./App.jsx", import.meta.url));

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
});
