import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function modalFocusableElements(dialog) {
  if (!dialog?.querySelectorAll) return [];
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    element?.getAttribute?.("aria-hidden") !== "true"
  ));
}

export function trapModalFocus(event, dialog) {
  if (event?.key !== "Tab" || !dialog) return false;
  const focusable = modalFocusableElements(dialog);
  if (focusable.length === 0) {
    event.preventDefault?.();
    dialog.focus?.();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && event.target === first) {
    event.preventDefault?.();
    last.focus?.();
    return true;
  }
  if (!event.shiftKey && event.target === last) {
    event.preventDefault?.();
    first.focus?.();
    return true;
  }
  return false;
}

export function useModalFocus(onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof document === "undefined") return undefined;
    const opener = document.activeElement;
    const initial = dialog.querySelector?.("[autofocus]")
      || modalFocusableElements(dialog)[0]
      || dialog;
    initial.focus?.();

    const onKeyDown = (event) => {
      if (event.key === "Escape" && !event.defaultPrevented) {
        event.preventDefault();
        event.stopPropagation?.();
        closeRef.current?.();
        return;
      }
      trapModalFocus(event, dialog);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (opener?.isConnected !== false) opener?.focus?.();
    };
  }, []);

  return dialogRef;
}
