import { describe, expect, it, vi } from "vitest";
import { trapModalFocus } from "./modalFocus.js";

function keyEvent({ key = "Tab", shiftKey = false, target }) {
  return {
    key,
    shiftKey,
    target,
    preventDefault: vi.fn(),
  };
}

describe("modal focus containment", () => {
  it("wraps Tab from the last control to the first", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const dialog = { querySelectorAll: () => [first, last], focus: vi.fn() };
    const event = keyEvent({ target: last });

    expect(trapModalFocus(event, dialog)).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(first.focus).toHaveBeenCalledOnce();
  });

  it("wraps Shift+Tab from the first control to the last", () => {
    const first = { focus: vi.fn() };
    const last = { focus: vi.fn() };
    const dialog = { querySelectorAll: () => [first, last], focus: vi.fn() };
    const event = keyEvent({ target: first, shiftKey: true });

    trapModalFocus(event, dialog);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(last.focus).toHaveBeenCalledOnce();
  });

  it("keeps focus on the dialog when it has no enabled controls", () => {
    const dialog = { querySelectorAll: () => [], focus: vi.fn() };
    const event = keyEvent({ target: dialog });

    trapModalFocus(event, dialog);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(dialog.focus).toHaveBeenCalledOnce();
  });

  it("ignores non-Tab keys", () => {
    const dialog = { querySelectorAll: vi.fn(), focus: vi.fn() };
    const event = keyEvent({ key: "ArrowRight", target: dialog });

    expect(trapModalFocus(event, dialog)).toBe(false);
    expect(dialog.querySelectorAll).not.toHaveBeenCalled();
  });
});
