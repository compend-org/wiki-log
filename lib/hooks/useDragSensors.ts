// ABOUTME: The ways things can be dragged to reorder them: mouse, touch and keyboard.
// ABOUTME: Shared by everything that reorders by dragging, so they all start a drag the same way.
"use client";

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// Mouse drags after a few pixels, touch after a short press (so the page
// still scrolls), and the keyboard works too
export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
