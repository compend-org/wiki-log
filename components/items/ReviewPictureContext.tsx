// ABOUTME: The picture picked for the review being written on an item's page.
// ABOUTME: Shared by the item's big picture, where it's picked, and the log form, which saves it.
"use client";

import { createContext, type ReactNode, useContext, useState } from "react";
import type { PictureChoice } from "@/lib/pictureChoices";

type ReviewPicture = {
  // Null until a picture is picked, and again once the entry is saved
  picked: PictureChoice | null;
  pick: (choice: PictureChoice | null) => void;
};

const ReviewPictureContext = createContext<ReviewPicture>({
  picked: null,
  pick: () => {},
});

export function ReviewPictureProvider({ children }: { children: ReactNode }) {
  const [picked, pick] = useState<PictureChoice | null>(null);
  return (
    <ReviewPictureContext value={{ picked, pick }}>
      {children}
    </ReviewPictureContext>
  );
}

export function useReviewPicture(): ReviewPicture {
  return useContext(ReviewPictureContext);
}
