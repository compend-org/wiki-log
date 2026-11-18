"use client";

// ABOUTME: A box of people the viewer might want to follow, each with a Follow button.
// ABOUTME: The list is kept as first shown, so someone just followed stays put as "Following".

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { LINK_COLOR } from "@/components/logs/ReviewText";
import Avatar from "@/components/people/Avatar";
import FollowButton from "@/components/people/FollowButton";
import { track } from "@/lib/analytics/analytics";
import {
  type SuggestedPerson,
  shortTitle,
  suggestionParts,
} from "@/lib/feed/suggestedPeople";
import { createClient } from "@/lib/supabase/client";

export default function SuggestedPeople({
  viewerId,
  people,
  heading,
}: {
  // Left out for signed-out visitors, whose Follow buttons lead to sign-up
  viewerId?: string;
  people: SuggestedPerson[];
  heading: string;
}) {
  // Following someone refreshes the page, which would drop them from a fresh
  // list. Keeping the first list leaves their button showing "Following".
  const [shown] = useState(people);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    track("suggested_people_shown", {
      count: shown.length,
      signed_in: Boolean(viewerId),
    });
  }, [shown.length, viewerId]);

  async function dismiss() {
    if (!viewerId) return;
    setDismissed(true);
    track("suggested_people_dismissed");
    // If this doesn't save, the box is only back on the next visit
    await createClient().from("user_settings").upsert({
      user_id: viewerId,
      suggested_people_dismissed_at: new Date().toISOString(),
    });
  }

  if (dismissed) return null;

  return (
    <section
      aria-label={heading}
      // As wide as the tabs above the feed
      className="relative mx-auto flex w-full max-w-2xl flex-col gap-3 rounded-lg border border-line p-4 lg:w-[calc(50%-0.75rem)]"
    >
      {/* Only signed-in people can close it, as it is remembered on their account */}
      {viewerId && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss suggestions"
          title="Hide this for a while"
          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded text-danger hover:opacity-70"
        >
          <span aria-hidden className="text-2xl leading-none">
            ×
          </span>
        </button>
      )}
      <h2 className={`font-semibold ${viewerId ? "pr-8" : ""}`}>{heading}</h2>
      <ul className="flex flex-col gap-3">
        {shown.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <Link
              href={`/u/${encodeURIComponent(p.username)}`}
              className="shrink-0"
            >
              <Avatar name={p.username} path={p.avatar_path} size={40} />
            </Link>
            <div className="flex min-w-0 flex-1 flex-col">
              <Link
                href={`/u/${encodeURIComponent(p.username)}`}
                className="truncate font-medium hover:underline"
              >
                {p.username}
              </Link>
              <p className="[overflow-wrap:anywhere] text-sm text-muted">
                {suggestionParts(p).map((part) =>
                  typeof part === "string" ? (
                    <Fragment key={part}>{part}</Fragment>
                  ) : (
                    <Link
                      key={part.id}
                      href={`/item/${part.id}`}
                      className={`hover:underline ${LINK_COLOR}`}
                    >
                      {shortTitle(part.title)}
                    </Link>
                  ),
                )}
              </p>
            </div>
            {viewerId ? (
              <FollowButton
                viewerId={viewerId}
                targetId={p.id}
                following={false}
                followsViewer={p.reason === "follows_you"}
                compact
                source="suggestions"
              />
            ) : (
              <Link
                href="/login?mode=signup"
                onClick={() => track("suggested_people_signup_clicked")}
                className="rounded-lg bg-accent px-3 py-1.5 text-sm text-background hover:opacity-80"
              >
                Follow
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
