import { describe, expect, it, vi } from "vitest";
import { activateModalFocus, trapModalFocus } from "./modalFocus.js";

function keyEvent({ key = "Tab", shiftKey = false, target }) {
  return {
    key,
    shiftKey,
    target,
    preventDefault: vi.fn(),
  };
}

describe("modal focus containment", () => {
  it("captures the exact opener before focusing the modal and restores it on cleanup", () => {
    let activeElement;
    const opener = { isConnected: true, focus: vi.fn(() => { activeElement = opener; }) };
    const initial = {
      focus: vi.fn(() => { activeElement = initial; }),
      getAttribute: vi.fn(() => null),
    };
    activeElement = opener;
    const dialog = {
      querySelector: vi.fn((selector) => selector === "[data-modal-autofocus]" ? initial : null),
      querySelectorAll: vi.fn(() => [initial]),
      focus: vi.fn(),
    };
    const listeners = new Map();
    const windowTarget = {
      addEventListener: vi.fn((type, listener) => listeners.set(type, listener)),
      removeEventListener: vi.fn((type) => listeners.delete(type)),
    };
    const documentTarget = { get activeElement() { return activeElement; } };
    const onClose = vi.fn();

    const cleanup = activateModalFocus(dialog, onClose, { documentTarget, windowTarget });
    expect(activeElement).toBe(initial);
    expect(dialog.querySelector).toHaveBeenCalledWith("[data-modal-autofocus]");

    listeners.get("keydown")({
      key: "Escape",
      defaultPrevented: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    });
    expect(onClose).toHaveBeenCalledOnce();

    cleanup();
    expect(opener.focus).toHaveBeenCalledOnce();
    expect(activeElement).toBe(opener);
  });

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
