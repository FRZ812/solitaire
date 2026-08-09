import { describe, expect, it } from "vitest";
import { cloneJsonData, isJsonData } from "./json-data.js";

describe("bounded JSON data snapshots", () => {
  it("clones own __proto__ data without mutating the clone or global prototype", () => {
    const source = {};
    Object.defineProperty(source, "__proto__", {
      enumerable: true,
      value: { polluted: true },
    });

    const cloned = cloneJsonData(source);

    expect(Object.hasOwn(cloned, "__proto__")).toBe(true);
    expect(cloned.__proto__).toEqual({ polluted: true });
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype);
    expect(Object.prototype.polluted).toBeUndefined();
  });

  it("rejects accessor data without executing getters", () => {
    let getterCalls = 0;
    const source = {};
    Object.defineProperty(source, "value", {
      enumerable: true,
      get: () => { getterCalls += 1; return 1; },
    });

    expect(isJsonData(source)).toBe(false);
    expect(() => cloneJsonData(source)).toThrow("invalid-json-data");
    expect(getterCalls).toBe(0);
  });

  it("fails closed rather than propagating revoked Proxy trap errors", () => {
    const { proxy, revoke } = Proxy.revocable({ value: 1 }, {});
    revoke();

    expect(isJsonData(proxy)).toBe(false);
    expect(() => cloneJsonData(proxy)).toThrow("invalid-json-data");
  });

  it("rejects excessive nesting with a stable error instead of overflowing the stack", () => {
    const root = {};
    let cursor = root;
    for (let depth = 0; depth < 140; depth += 1) {
      cursor.next = {};
      cursor = cursor.next;
    }

    expect(isJsonData(root)).toBe(false);
    expect(() => cloneJsonData(root)).toThrow("invalid-json-data");
  });
});
