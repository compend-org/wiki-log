// ABOUTME: The row of actions under a review, with "Add to list" on the right.
// ABOUTME: Opens a picker of the viewer's review lists, with a search box and a way to start a new one.
"use client";

import { type ReactNode, useRef, useState } from "react";
import { addReviewToList, createReviewList } from "@/app/actions";
import { track } from "@/lib/analytics/analytics";
import { UNREACHABLE } from "@/lib/lists/listEditing";
import {
  appendLists,
  fetchPickerLists,
  type PickerList,
} from "@/lib/lists/listPicker";
import { createClient } from "@/lib/supabase/client";

export default function AddReviewToList({
  logId,
  author,
  canAdd,
  actions,
  aside,
}: {
  logId: string;
  // The review's author, named in the confirmation
  author: string;
  // Whether the viewer may add it: they're signed in and the review has text
  canAdd: boolean;
  // The review's other actions, on the left of the row
  actions: ReactNode;
  // Shown just left of the button, such as "In n lists"
  aside?: ReactNode;
}) {
  const [open, setOpen] = useState<boolean>(false);
  const [lists, setLists] = useState<PickerList[] | null>(null);
  // How many of the person's review lists match the search, loaded or not
  const [listTotal, setListTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  // The search the shown lists are for, which "Show more" carries on
  const [shownSearch, setShownSearch] = useState<string>("");
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  // Only the latest request for lists is shown, as searches can overtake
  const listRequest = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The title being typed for a new review list, or null when not making one
  const [newTitle, setNewTitle] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function loadListPage(query: string, offset: number) {
    const request = ++listRequest.current;
    const page = await fetchPickerLists(
      createClient(),
      { logId },
      query,
      offset,
    );
    if (request !== listRequest.current) return;
    setLoadingMore(false);
    if (offset === 0) setShownSearch(query);
    if (page.error) {
      setError(page.error);
      if (offset === 0) setLists([]);
      return;
    }
    if (page.total !== null) setListTotal(page.total);
    setLists((shown) =>
      offset === 0 || !shown ? page.lists : appendLists(shown, page.lists),
    );
  }

  function changeSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadListPage(value, 0), 250);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    setNewTitle(null);
    setMessage("");
    setError("");
    if (next) loadListPage(search, 0);
  }

  // Runs an action, showing "Added to …" when it worked
  async function run(
    listTitle: string,
    action: () => Promise<{ error?: string }>,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    setMessage("");
    let result: { error?: string };
    try {
      result = await action();
    } catch {
      result = { error: UNREACHABLE };
    } finally {
      setBusy(false);
    }
    if (result.error) {
      setError(result.error);
      return false;
    }
    setMessage(`Added to “${listTitle}”. ${author} will get a notification.`);
    return true;
  }

  async function choose(list: PickerList) {
    if (list.has || busy) return;
    const added = await run(list.title, () =>
      addReviewToList({ listId: list.id, logId }),
    );
    if (!added) return;
    track("list_review_added");
    setLists(
      (prev) =>
        prev?.map((l) =>
          l.id === list.id ? { ...l, has: true, count: l.count + 1 } : l,
        ) ?? prev,
    );
  }

  async function create() {
    const title = (newTitle ?? "").trim();
    if (title.length < 1 || busy) return;
    const made = await run(title, () => createReviewList({ title, logId }));
    if (!made) return;
    track("list_created", { item_count: 1, ranked: false, of_reviews: true });
    setNewTitle(null);
    loadListPage(shownSearch, 0);
  }

  const moreLists =
    lists !== null && search === shownSearch ? listTotal - lists.length : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {actions}
        <div className="ml-auto flex items-center gap-4">
          {aside}
          {canAdd && (
            <button
              type="button"
              onClick={toggleOpen}
              aria-expanded={open}
              className={`rounded-lg border px-4 py-2 text-sm hover:border-accent ${
                open ? "border-accent" : "border-line"
              }`}
            >
              Add to list
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="card flex flex-col gap-3 p-3">
          {message ? (
            <p className="text-sm text-accent">{message}</p>
          ) : newTitle !== null ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                create();
              }}
              className="flex flex-col gap-2 text-sm"
            >
              <label className="flex flex-col gap-1">
                New review list
                <input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={80}
                  placeholder="Title"
                  // biome-ignore lint/a11y/noAutofocus: opened by the user to type a title
                  autoFocus
                  className="rounded-lg border border-line bg-surface px-3 py-2 text-foreground"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={busy || newTitle.trim() === ""}
                  className="rounded-lg bg-accent px-4 py-2 text-background disabled:opacity-40"
                >
                  {busy ? "Creating…" : "Create and add"}
                </button>
                <button
                  type="button"
                  onClick={() => setNewTitle(null)}
                  disabled={busy}
                  className="rounded-lg border border-line px-4 py-2 disabled:opacity-40"
                >
                  Back
                </button>
              </div>
            </form>
          ) : (
            <>
              <input
                type="search"
                value={search}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="Search your review lists"
                aria-label="Search your review lists"
                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-foreground"
              />
              {lists === null && (
                <p className="text-sm text-muted">Loading your lists…</p>
              )}
              {lists !== null && lists.length === 0 && (
                <p className="text-sm text-muted">
                  {search.trim()
                    ? `None of your review lists have “${search.trim()}” in their title.`
                    : "You have no review lists yet."}
                </p>
              )}
              {lists?.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => choose(l)}
                  disabled={l.has || busy}
                  className="flex items-baseline justify-between gap-3 rounded-lg border border-line px-3 py-2 text-left hover:border-accent disabled:opacity-60 disabled:hover:border-line"
                >
                  <span className="font-semibold">{l.title}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {l.has
                      ? "In this list"
                      : `${l.ranked ? "Ranked · " : ""}${l.count} ${
                          l.count === 1 ? "review" : "reviews"
                        }`}
                  </span>
                </button>
              ))}
              {moreLists > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (!lists) return;
                    setLoadingMore(true);
                    loadListPage(shownSearch, lists.length);
                  }}
                  disabled={loadingMore}
                  className="self-start text-sm underline disabled:opacity-60"
                >
                  {loadingMore
                    ? "Loading…"
                    : `Show more lists (${moreLists.toLocaleString("en-US")} more)`}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setNewTitle("");
                }}
                className="self-start text-sm underline"
              >
                New review list
              </button>
            </>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
