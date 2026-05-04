import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

export function focusFirstDialogButton(dialogRef: RefObject<HTMLDivElement | null>): void {
  dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
}

export function handleEscapeKey(
  event: ReactKeyboardEvent<HTMLDivElement>,
  onClose: () => void
): boolean {
  if (event.key !== "Escape") {
    return false;
  }

  event.preventDefault();
  onClose();
  return true;
}

export function trapButtonFocus(
  event: ReactKeyboardEvent<HTMLDivElement>,
  dialogRef: RefObject<HTMLDivElement | null>
): void {
  if (event.key !== "Tab") {
    return;
  }

  const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);

  if (buttons.length === 0) {
    return;
  }

  const firstButton = buttons[0];
  const lastButton = buttons[buttons.length - 1];

  if (event.shiftKey && document.activeElement === firstButton) {
    event.preventDefault();
    lastButton.focus();
    return;
  }

  if (!event.shiftKey && document.activeElement === lastButton) {
    event.preventDefault();
    firstButton.focus();
  }
}
