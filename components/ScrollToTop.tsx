"use client";

// ABOUTME: A round button in the bottom right that scrolls back to the top.
// ABOUTME: It fades in once the page has been scrolled more than a screen down.

import { useEffect, useState } from "react";
import ArrowUpIcon from "@/components/ArrowUpIcon";

export default function ScrollToTop() {
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const update = () => setVisible(window.scrollY > window.innerHeight);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      title="Back to top"
      // Hidden, it can't be clicked or reached with the keyboard. It sits
      // just above the footer, which sticks to the bottom of the screen.
      inert={!visible}
      className={`scroll-to-top card round fixed right-6 bottom-16 z-30 flex h-11 w-11 items-center justify-center text-muted transition-opacity duration-300 hover:border-accent hover:text-accent ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUpIcon />
    </button>
  );
}
