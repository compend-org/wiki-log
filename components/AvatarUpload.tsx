// ABOUTME: Lets someone upload, change or remove their profile picture.
// ABOUTME: Pictures are cropped to a square and stored at full and small sizes.
"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import Avatar from "@/components/Avatar";
import { track } from "@/lib/analytics";
import { AVATAR_SIZE, AVATAR_SMALL_SIZE, smallAvatarPath } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";

// Centre-crop to a square, shrink, and re-encode as JPEG (this also drops
// metadata such as location data stored in photos)
async function toSquareJpeg(bitmap: ImageBitmap, size: number): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  ctx.fillStyle = "#111b26"; // behind any transparent areas
  ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingQuality = "high"; // keeps big shrinks from looking jagged
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))),
      "image/jpeg",
      0.85,
    ),
  );
}

export default function AvatarUpload({
  userId,
  username,
  path,
}: {
  userId: string;
  username: string;
  path: string | null;
}) {
  const [busy, setBusy] = useState<boolean>(false);
  const [refreshing, startRefresh] = useTransition();
  const [error, setError] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still triggers this
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is over 10 MB.");
      return;
    }

    setBusy(true);
    setError("");

    let blob: Blob;
    let smallBlob: Blob;
    try {
      const bitmap = await createImageBitmap(file);
      blob = await toSquareJpeg(bitmap, AVATAR_SIZE);
      smallBlob = await toSquareJpeg(bitmap, AVATAR_SMALL_SIZE);
      bitmap.close();
    } catch {
      setBusy(false);
      setError("Couldn't read that image. Try a JPEG or PNG.");
      return;
    }

    const supabase = createClient();
    const newPath = `${userId}/${Date.now()}.jpg`;
    const newPaths = [newPath, smallAvatarPath(newPath)];
    const uploadOptions = {
      contentType: "image/jpeg",
      cacheControl: "31536000",
    };

    const uploads = await Promise.all([
      supabase.storage.from("avatars").upload(newPath, blob, uploadOptions),
      supabase.storage
        .from("avatars")
        .upload(smallAvatarPath(newPath), smallBlob, uploadOptions),
    ]);
    const uploadError = uploads.find((u) => u.error)?.error;
    if (uploadError) {
      await supabase.storage.from("avatars").remove(newPaths);
      setBusy(false);
      setError(uploadError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: newPath })
      .eq("id", userId);
    if (updateError) {
      await supabase.storage.from("avatars").remove(newPaths);
      setBusy(false);
      setError(updateError.message);
      return;
    }

    // The new picture is live, so the old file can go
    if (path) {
      await supabase.storage
        .from("avatars")
        .remove([path, smallAvatarPath(path)]);
    }

    track("profile_updated", { field: "avatar" });
    setBusy(false);
    // Brings the new picture back from the server, for here and the top bar
    startRefresh(() => router.refresh());
  }

  async function handleRemove() {
    if (!path) return;
    setBusy(true);
    setError("");

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_path: null })
      .eq("id", userId);
    if (updateError) {
      setBusy(false);
      setError(updateError.message);
      return;
    }

    await supabase.storage
      .from("avatars")
      .remove([path, smallAvatarPath(path)]);
    track("profile_updated", { field: "avatar" });
    setBusy(false);
    startRefresh(() => router.refresh());
  }

  return (
    <section className="flex items-center gap-4">
      <Avatar name={username || "?"} path={path} size={80} />
      <div className="flex flex-col items-start gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy || refreshing}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-40"
          >
            {busy || refreshing
              ? "Working…"
              : path
                ? "Change picture"
                : "Upload picture"}
          </button>
          {path && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy || refreshing}
              className="text-sm text-muted underline disabled:opacity-40"
            >
              Remove
            </button>
          )}
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}
