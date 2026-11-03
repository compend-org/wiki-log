"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EditEntryForm from "@/components/EditEntryForm";

export default function EditEntry({
  logId,
  initialRating,
  initialReview,
  onSaved,
  className = "",
}: {
  logId: string;
  initialRating: number | null;
  initialReview: string;
  onSaved?: (rating: number | null, review: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const router = useRouter();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-sm text-accent underline hover:no-underline ${className}`}
      >
        Edit
      </button>
    );
  }

  return (
    <EditEntryForm
      logId={logId}
      initialRating={initialRating}
      initialReview={initialReview}
      onSaved={(rating, review) => {
        onSaved?.(rating, review);
        router.refresh();
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}