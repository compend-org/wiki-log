"use client";

import * as Sentry from "@sentry/nextjs";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { logItem } from "@/app/actions";
import { deleteLogDraft, saveLogDraft } from "@/app/draftActions";
import SignUpPrompt from "@/components/auth/SignUpPrompt";
import AutosaveStatus from "@/components/drafts/AutosaveStatus";
import DraftNotice from "@/components/drafts/DraftNotice";
import { useReviewDraft } from "@/components/items/ReviewDraftContext";
import RatingInput from "@/components/logs/RatingInput";
import ReviewTextarea from "@/components/logs/ReviewTextArea";
import { track } from "@/lib/analytics/analytics";
import { submitOnModEnter } from "@/lib/hooks/submitShortcut";
import { useAutosave } from "@/lib/hooks/useAutosave";
import { hasLogContent, NEEDS_CONTENT } from "@/lib/logContent";

type Props = {
  id: string;
  signedIn: boolean;
  alreadyLogged?: boolean;
};

export default function LogForm(props: Props) {
  // Starts over when the page brings a draft saved somewhere else
  const { version } = useReviewDraft();
  if (!props.signedIn) {
    return (
      <SignUpPrompt reason="Create a free account to rate and review this, and make lists of your own." />
    );
  }
  return <EntryForm key={version} {...props} />;
}

function EntryForm({ id, alreadyLogged = false }: Props) {
  const t = useTranslations();
  // A picture picked on the item's big picture, saved with the entry
  const { picked, pick, draft, savedAt, setSavedAt } = useReviewDraft();
  const [rating, setRating] = useState<number>(draft?.rating ?? 0);
  const [review, setReview] = useState<string>(draft?.review ?? "");
  // Whether the form opened with a saved draft, which gets a line saying so
  const [resumed, setResumed] = useState<boolean>(draft !== null);
  const [busy, setBusy] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const router = useRouter();

  const picture = picked && !picked.isDefault ? picked : null;
  const autosave = useAutosave({
    value: {
      rating,
      review,
      imageUrl: picture?.url ?? null,
      imageFilePage: picture?.filePage ?? null,
    },
    savedAt,
    save: (entry, at) =>
      saveLogDraft({
        itemId: id,
        rating: entry.rating > 0 ? entry.rating : null,
        review: entry.review,
        imageUrl: entry.imageUrl,
        imageFilePage: entry.imageFilePage,
        savedAt: at,
      }),
    onSaved: setSavedAt,
    // A rating alone isn't a draft until asked for with Save draft
    worthStarting: review.trim() !== "",
    paused: busy,
  });

  // Empties the form, whose draft has been logged or deleted
  function startOver() {
    setRating(0);
    setReview("");
    pick(null);
    setSavedAt(null);
    setResumed(false);
    autosave.forget({
      rating: 0,
      review: "",
      imageUrl: null,
      imageFilePage: null,
    });
  }

  async function handleDeleteDraft(): Promise<{ error?: string }> {
    const at = await autosave.settle();
    const result = at ? await deleteLogDraft({ itemId: id, savedAt: at }) : {};
    if (result.error) return result;
    track("draft_deleted", { kind: "log", from: "editor" });
    startOver();
    setDone(false);
    return {};
  }

  async function handleSaveDraft() {
    setDone(false);
    if (await autosave.saveNow()) track("draft_saved", { kind: "log" });
  }

  async function handleSave() {
    if (!hasLogContent(rating, review)) {
      setError(NEEDS_CONTENT);
      setDone(false);
      return;
    }
    setBusy(true);
    setError("");
    setDone(false);
    const draftSavedAt = await autosave.settle();
    let result: Awaited<ReturnType<typeof logItem>>;
    try {
      result = await logItem({
        itemId: id,
        rating: rating > 0 ? rating : null,
        review,
        imageUrl: picture?.url ?? null,
        draftSavedAt,
      });
    } catch (error) {
      // The server may have saved the entry before its response was lost.
      // Keep the draft and let the person check before submitting it again.
      setError(t("errors.entryUnconfirmed"));
      Sentry.captureException(error, {
        tags: { action: "logItem", error_source: "log-form" },
        contexts: {
          browser_state: {
            online: navigator.onLine,
            visibility_state: document.visibilityState,
          },
        },
      });
      return;
    } finally {
      setBusy(false);
    }
    if (result.error) {
      setError(result.error);
      return;
    }
    track("item_logged", {
      item_id: id,
      rating: rating > 0 ? rating : null,
      has_review: review.trim() !== "",
      review_length: review.trim().length,
      first_time: !alreadyLogged,
    });
    if (draftSavedAt) track("draft_published", { kind: "log" });
    // Ready for the next entry
    startOver();
    setDone(true);
    router.refresh();
  }

  const empty = rating === 0 && review.trim() === "" && picture === null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the handler only catches Cmd/Ctrl+Enter bubbling up from the fields inside
    <div className="flex w-full flex-col gap-3" onKeyDown={submitOnModEnter}>
      {resumed && savedAt && (
        <DraftNotice
          label={t("drafts.yourDraft")}
          onDelete={handleDeleteDraft}
        />
      )}
      <RatingInput
        value={rating}
        onChange={(v) => {
          setRating(v);
          setDone(false);
        }}
      />
      <ReviewTextarea
        value={review}
        onChange={(v) => {
          setReview(v);
          setDone(false);
        }}
        placeholder={t("logs.addAReviewOrJust")}
        rows={3}
        className="border border-line bg-surface px-4 py-2 text-foreground"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          data-submit
          onClick={handleSave}
          disabled={busy}
          className="bg-accent px-4 py-2 text-background disabled:opacity-40"
        >
          {busy
            ? t("common.saving")
            : alreadyLogged
              ? t("logs.logItAgain")
              : t("logs.logIt")}
        </button>
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={busy || (empty && savedAt === null)}
          className="border border-line px-4 py-2 hover:border-accent disabled:opacity-40"
        >
          {t("drafts.saveDraft")}
        </button>
        <AutosaveStatus state={autosave.state} savedAt={savedAt} />
      </div>
      {done && <p className="text-sm text-accent">{t("logs.entryAdded")}</p>}
      {error && <p className="text-danger">{error}</p>}
    </div>
  );
}
