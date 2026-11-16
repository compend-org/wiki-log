import type { KeyboardEvent } from "react";

/** Cmd/Ctrl+Enter clicks the [data-submit] button inside the element. */
export function submitOnModEnter(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
  if (e.nativeEvent.isComposing) return; // IME composition
  const button =
    e.currentTarget.querySelector<HTMLButtonElement>("[data-submit]");
  if (!button || button.disabled) return;
  e.preventDefault();
  button.click();
}
