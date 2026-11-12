// ABOUTME: Lets someone upload, change or remove their profile picture.
// ABOUTME: Pictures are cropped to a square and stored at full and small sizes.
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Avatar from "@/components/Avatar";
import { track } from "@/lib/analytics";
import { AVATAR_SIZE, AVATAR_SMALL_SIZE, smallAvatarPath } from "@/lib/avatar";
import { encodeJpeg } from "@/lib/jpeg";
import { createClient } from "@/lib/supabase/client";

// Centre-crop to a square, shrink, and re-encode as JPEG (this also drops
// metadata such as location data stored in photos)
function toSquareJpeg(bitmap: ImageBitmap, size: number): Promise<Blob> {
  const side = Math.min(bitmap.width, bitmap.height);
  const x = (bitmap.width - side) / 2;
  const y = (bitmap.height - side) / 2;
  return encodeJpeg(bitmap, { x, y, width: side, height: side }, size, size);
}

export default function AvatarUpload() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("");
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;
      setUserId(userData.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_path")
        .eq("id", userData.user.id)
        .maybeSingle();
      setUsername(data?.username ?? "");
      setPath(data?.avatar_path ?? null);
    }
    load();
  }, []);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still triggers this
    if (!file || !userId) return;

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
    setPath(newPath);
    setBusy(false);
    router.refresh();
  }

  async function handleRemove() {
    if (!userId || !path) return;
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
    setPath(null);
    setBusy(false);
    router.refresh();
  }

  if (!userId) return null;

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
            disabled={busy}
            className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-accent disabled:opacity-40"
          >
            {busy ? "Working…" : path ? "Change picture" : "Upload picture"}
          </button>
          {path && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
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
