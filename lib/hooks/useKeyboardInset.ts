// ABOUTME: How much of the bottom of the window the phone's on-screen keyboard covers.
// ABOUTME: Lets something pinned to the bottom of the screen sit just above the keyboard.
import { useEffect, useState } from "react";

// Pixels hidden at the bottom of the window, 0 when no keyboard is up. Phones
// cover the page with the keyboard without resizing it, so this measures
// what's actually visible.
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const view = window.visualViewport;
    if (!view) return;
    const measure = () =>
      setInset(Math.max(0, window.innerHeight - view.height - view.offsetTop));
    measure();
    view.addEventListener("resize", measure);
    view.addEventListener("scroll", measure);
    return () => {
      view.removeEventListener("resize", measure);
      view.removeEventListener("scroll", measure);
    };
  }, []);

  return inset;
}
