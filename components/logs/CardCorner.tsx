// ABOUTME: The top-right corner of a card, where its owner's controls go.
// ABOUTME: Stacks them, such as Delete above Pin, wherever the card's text columns fall.
import type { ReactNode } from "react";

// An open menu in the corner rises above the card's text
export default function CardCorner({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-3 top-3.5 z-10 flex flex-col items-end gap-2 has-[[aria-expanded=true]]:z-20">
      {children}
    </div>
  );
}
