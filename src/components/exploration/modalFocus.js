import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function modalFocusableElements(dialog) {
  if (!dialog?.querySelectorAll) return [];
  return [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => (
    !element.disabled
    && !element.hidden
    && element.getAttribute?.("aria-hidden") !== "true"
    && (() => {
      const closedDetails = element.closest?.("details:not([open])");
      return !closedDetails || closedDetails.querySelector?.(":scope > summary") === element;
    })()
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

export function activateModalFocus(dialog, onClose, options = {}) {
  const documentTarget = options.documentTarget
    || (typeof document !== "undefined" ? document : null);
  const windowTarget = options.windowTarget
    || (typeof window !== "undefined" ? window : null);
  if (!dialog || !documentTarget || !windowTarget) return () => {};

  // Capture before moving focus. Native React `autoFocus` runs during commit,
  // before effects, and would otherwise replace the true opener here.
  const opener = documentTarget.activeElement;
  const initial = dialog.querySelector?.("[data-modal-autofocus]")
    || modalFocusableElements(dialog)[0]
    || dialog;
  initial.focus?.();

  const onKeyDown = (event) => {
    if (
      event.key === "Escape"
      && !event.defaultPrevented
      && !event.target?.closest?.("[data-modal-escape-boundary]")
    ) {
      event.preventDefault();
      event.stopPropagation?.();
      onClose?.();
      return;
    }
    trapModalFocus(event, dialog);
  };
  windowTarget.addEventListener("keydown", onKeyDown, true);
  return () => {
    windowTarget.removeEventListener("keydown", onKeyDown, true);
    if (opener?.isConnected !== false) opener?.focus?.();
  };
}

export function useModalFocus(onClose) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    return activateModalFocus(dialog, () => closeRef.current?.());
  }, []);

  return dialogRef;
}
