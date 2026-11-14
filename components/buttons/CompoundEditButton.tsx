// ABOUTME: The pencil that lets whoever crafted a compound change its name, description and picture.
// ABOUTME: Opens a popup with the form; the ingredients can't be changed.
"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type CompoundDetails, updateCompound } from "@/app/actions";
import Dialog from "@/components/Dialog";
import EditIcon from "@/components/icons/EditIcon";

// The drawing window is only loaded once someone opens it
const PaintEditor = dynamic(() => import("@/components/PaintEditor"), {
  ssr: false,
});

// A saved picture, as a data URL the drawing window can start from
async function pictureAsDataUrl(url: string): Promise<string | null> {
  try {
    const blob = await (await fetch(url)).blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function CompoundEditButton({
  id,
  title,
  description,
  imageUrl,
  onSaved,
  iconClassName = "h-4 w-4",
}: {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  // What to do once it's saved. Refreshes the page either way.
  onSaved?: (details: CompoundDetails) => void;
  // The size of the pencil
  iconClassName?: string;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [name, setName] = useState<string>(title);
  const [text, setText] = useState<string>(description);
  // What the picture shows now, and what to send: nothing when it is unchanged
  const [picture, setPicture] = useState<string | null>(imageUrl);
  const [pictureChanged, setPictureChanged] = useState<boolean>(false);
  // The drawing window's starting point, once loaded: null starts blank
  const [drawing, setDrawing] = useState<{ start: string | null } | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  function openForm() {
    setName(title);
    setText(description);
    setPicture(imageUrl);
    setPictureChanged(false);
    setError("");
    setOpen(true);
  }

  async function startDrawing() {
    setError("");
    if (!picture) return setDrawing({ start: null });
    if (picture.startsWith("data:")) return setDrawing({ start: picture });
    const start = await pictureAsDataUrl(picture);
    if (start === null) {
      setError("Couldn't load the picture to edit it. Try again.");
      return;
    }
    setDrawing({ start });
  }

  async function handleSave() {
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await updateCompound({
      id,
      title: name,
      description: text,
      ...(pictureChanged ? { image: picture } : {}),
    });
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setOpen(false);
    onSaved?.(result.details);
    router.refresh();
  }

  return (
    <span className="relative z-10 inline-flex">
      <button
        type="button"
        onClick={openForm}
        aria-label="Edit this compound"
        title="Edit this compound"
        className="flex text-accent hover:opacity-70 hover:text-foreground"
      >
        <EditIcon className={iconClassName} />
      </button>

      {open && drawing && (
        <PaintEditor
          initial={drawing.start}
          onSave={(png) => {
            setPicture(png);
            setPictureChanged(true);
            setDrawing(null);
          }}
          onCancel={() => setDrawing(null)}
        />
      )}
      {open && !drawing && (
        <Dialog label="Edit this compound" onClose={() => setOpen(false)}>
          <h2 className="text-base font-semibold">Edit this compound</h2>
          <label className="flex flex-col gap-1">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={80}
              className="border border-line bg-surface px-3 py-2 text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1">
            Description
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              className="border border-line bg-surface px-3 py-2 text-foreground"
            />
          </label>
          <div className="flex items-center gap-3">
            <span
              role="img"
              aria-label="Its picture"
              className="h-[102px] w-[102px] shrink-0 border border-line bg-surface"
              style={{
                backgroundImage: picture ? `url("${picture}")` : undefined,
                backgroundSize: "100% 100%",
                imageRendering: "pixelated",
              }}
            />
            <span className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={startDrawing}
                className="border border-line px-3 py-1"
              >
                {picture ? "Edit drawing" : "Draw a picture"}
              </button>
              {picture && (
                <button
                  type="button"
                  onClick={() => {
                    setPicture(null);
                    setPictureChanged(true);
                  }}
                  className="text-xs text-muted underline"
                >
                  Remove
                </button>
              )}
            </span>
          </div>
          {error && <p className="text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-line px-3 py-1"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy || name.trim().length === 0}
              className="bg-accent px-4 py-1 text-background disabled:opacity-40"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog>
      )}
    </span>
  );
}
