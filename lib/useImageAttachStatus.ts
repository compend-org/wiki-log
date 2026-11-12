// ABOUTME: React hook that asks the database whether the signed-in person can attach images.
// ABOUTME: New and blocked accounts can't; the database enforces the same rule when they post.
"use client";

import { useEffect, useState } from "react";
import type { ImageAttachStatus } from "@/lib/postImages";
import { createClient } from "@/lib/supabase/client";

// The viewer's status, or null while finding out or when signed out
export function useImageAttachStatus(
  viewerId: string | null,
): ImageAttachStatus | null {
  const [status, setStatus] = useState<ImageAttachStatus | null>(null);
  useEffect(() => {
    if (!viewerId) return;
    createClient()
      .rpc("my_image_attach_status")
      .then(({ data }) => setStatus(data as ImageAttachStatus));
  }, [viewerId]);
  return status;
}
