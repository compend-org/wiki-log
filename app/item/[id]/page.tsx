import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { cache } from "react";
import CompoundDeleteButton from "@/components/craft/CompoundDeleteButton";
import CompoundEditButton from "@/components/craft/CompoundEditButton";
import ItemHeroPicture from "@/components/items/ItemHeroPicture";
import ItemImage from "@/components/items/ItemImage";
import RandomAgain from "@/components/items/RandomAgain";
import { ReviewPictureProvider } from "@/components/items/ReviewPictureContext";
import AddToList from "@/components/lists/AddToList";
import ItemLists from "@/components/lists/ItemLists";
import ItemLogs from "@/components/logs/ItemLogs";
import LogForm from "@/components/logs/LogForm";
import MyEntries, { type MyEntry } from "@/components/logs/MyEntries";
import RatingHistogram from "@/components/logs/RatingsHistogram";
import ItemAdminMenu from "@/components/moderation/ItemAdminMenu";
import ShareImageButton from "@/components/social/ShareImageButton";
import { isAdmin } from "@/lib/admin/admin";
import { FEATURES } from "@/lib/features";
import { timeAgo } from "@/lib/format";
import { isCompoundId } from "@/lib/ids";
import { getItemLogs, getMostLikedLogs } from "@/lib/itemLogs";
import { getItemRatings } from "@/lib/itemRatings";
import { getItemForPage } from "@/lib/items";
import { getItemLists } from "@/lib/lists/itemLists";
import {
  itemDescription,
  itemPreviewImage,
  pageMetadata,
} from "@/lib/metadata";
import { RANDOM_PARAM } from "@/lib/randomItem";
import { CONTACT_EMAIL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import { getViewerState } from "@/lib/viewerState";
import { BUSY_ERROR } from "@/lib/wikipedia/articleSummary";

export const instant = false;

type Part = {
  id: string;
  title: string;
  imageUrl: string | null;
  nsfw: boolean;
};

// Cached per request, so the page and its metadata share one lookup
const getItem = cache(async (id: string) => {
  const result = await getItemForPage(id);
  if ("item" in result && result.item.id !== id) {
    // Wikimedia mappings can change, so don't permanently cache this redirect.
    redirect(`/item/${result.item.id}`);
  }
  return result;
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await connection();
  const { id } = await params;
  if (isCompoundId(id) && !FEATURES.compounds) return {};
  const result = await getItem(id);
  if ("error" in result) return {};

  const { item } = result;
  // The page reads the same ratings, so this costs no extra request
  const { ratings } = await getItemRatings(id);
  return pageMetadata({
    title: item.title,
    description: itemDescription({
      title: item.title,
      about: item.description,
      ratings,
    }),
    path: `/item/${item.id}`,
    ...(item.imageUrl && itemPreviewImage(item.id, item.imageUrl)),
  });
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [RANDOM_PARAM]?: string }>;
}) {
  const t = await getTranslations();
  const locale = await getLocale();
  await connection();
  const renderedAt = Date.now();
  const { id } = await params;
  const { [RANDOM_PARAM]: random } = await searchParams;

  const result = await getItem(id);
  if (isCompoundId(id) && !FEATURES.compounds) notFound();
  if ("error" in result) {
    if (result.error !== BUSY_ERROR) notFound();
    // The item may well exist: Wikipedia just didn't answer in time
    return (
      <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
        <h1 className="text-3xl font-bold">{t("pages.itemBusy.title")}</h1>
        <p>{t("pages.itemBusy.body")}</p>
      </main>
    );
  }
  const { item } = result;

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const viewerId: string | undefined = claimsData?.claims?.sub;
  const viewerIsAdmin = await isAdmin(viewerId);

  // For admins: who last marked the item NSFW or safe by hand, and when
  let nsfwSetBy: string | null = null;
  let nsfwSetDate: string | null = null;
  if (viewerIsAdmin) {
    const { data: flag } = await supabase
      .from("items")
      .select("nsfw_set_at, setter:profiles!nsfw_set_by(username)")
      .eq("id", item.id)
      .maybeSingle<{
        nsfw_set_at: string | null;
        setter: { username: string } | null;
      }>();
    if (flag?.nsfw_set_at) {
      const format = await getFormatter();
      nsfwSetBy = flag.setter?.username ?? null;
      nsfwSetDate = format.dateTime(new Date(flag.nsfw_set_at), {
        month: "short",
        day: "numeric",
      });
    }
  }

  // Everyone's latest rating of this item, one per person, for the histogram,
  // and the viewer's own earlier entries for it
  const { ratings, viewerEntries } = await getItemRatings(id);
  const myEntries: MyEntry[] = viewerEntries.map((r) => ({
    id: r.id,
    rating: Number(r.rating ?? 0),
    review: r.review,
    loggedAgo: timeAgo(r.logged_at, renderedAt, t, locale),
  }));
  // The viewer's own latest rating (entries are newest first; 0 means none)
  const myRating = myEntries.find((e) => e.rating > 0)?.rating ?? null;

  // For a compound: who made it, and from what
  const compound = isCompoundId(id);
  let madeFrom: Part[] = [];
  let creator: string | null = null;
  let creatorId: string | null = null;
  let createdAt: string | null = null;

  if (compound) {
    const { data: c } = await supabase
      .from("compounds")
      .select("creator_id, created_at")
      .eq("item_id", id)
      .maybeSingle();
    createdAt = c?.created_at ?? null;
    creatorId = c?.creator_id ?? null;

    const { data: partRows } = await supabase
      .from("compound_parts")
      .select("part_id, position")
      .eq("compound_id", id)
      .order("position");
    const partIds = (partRows ?? []).map((r) => r.part_id as string);

    if (partIds.length > 0) {
      const { data: partItems } = await supabase
        .from("items")
        .select("id, title, image_url, nsfw")
        .in("id", partIds);
      const byId = new Map((partItems ?? []).map((i) => [i.id as string, i]));
      madeFrom = partIds.flatMap((pid) => {
        const it = byId.get(pid);
        return it
          ? [
              {
                id: pid,
                title: it.title,
                imageUrl: it.image_url,
                nsfw: it.nsfw,
              },
            ]
          : [];
      });
    }

    if (c?.creator_id) {
      const { data: p } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", c.creator_id)
        .maybeSingle();
      creator = p?.username ?? null;
    }
  }

  // Compounds that use this item as an ingredient
  const { data: usedRows } = FEATURES.compounds
    ? await supabase
        .from("compound_parts")
        .select("compound_id")
        .eq("part_id", id)
        .limit(12)
    : { data: null };
  const usedIds = (usedRows ?? []).map((r) => r.compound_id as string);
  let usedIn: { id: string; title: string }[] = [];
  if (usedIds.length > 0) {
    const { data: ci } = await supabase
      .from("items")
      .select("id, title")
      .in("id", usedIds);
    usedIn = (ci ?? []) as { id: string; title: string }[];
  }

  // The logs and lists sections are loaded together so that one request can
  // answer what the viewer has liked, shared and blocked in both of them
  const mostLiked = await getMostLikedLogs(id);
  const [recentLogs, itemLists] = await Promise.all([
    getItemLogs(
      id,
      mostLiked.rows.map((r) => r.id),
      null,
    ),
    getItemLists(id, null),
  ]);
  // The reviews section starts over from its first page when the viewer adds,
  // edits or deletes one of their entries, or the most liked ones change,
  // since the pages it already loaded no longer match
  const logsKey = JSON.stringify([
    myEntries.map((e) => [e.id, e.rating, e.review]),
    mostLiked.rows.map((r) => r.id),
  ]);
  const viewer = await getViewerState(supabase, viewerId, {
    logIds: [...mostLiked.rows, ...recentLogs.rows].map((r) => r.id),
    listIds: itemLists.lists.map((l) => l.id),
  });

  const removalLink = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    t("item.removalRequestSubject", { title: item.title, id: item.id }),
  )}`;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 p-4 sm:p-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        {/* A picture picked for one item never carries over to another */}
        <ReviewPictureProvider key={item.id}>
          <div className="flex flex-col gap-3">
            {/* Reached by rolling a random article, so offer another roll */}
            {random && <RandomAgain />}
            {item.imageUrl ? (
              <ItemHeroPicture
                itemId={item.id}
                title={item.title}
                imageUrl={item.imageUrl}
                nsfw={item.nsfw}
                className={`item-img h-auto max-w-full border-2 border-dashed border-line bg-clip-padding [[data-theme=dark]_&]:bg-foreground ${
                  // Drawings are only 100 pixels wide: 3 or 4 times that, plus the border
                  compound ? "w-[304px] sm:w-[404px]" : "w-auto"
                }`}
                canPick={!compound && Boolean(viewerId)}
                credit={
                  compound ? (
                    creator ? (
                      t.rich("item.createdByUser", {
                        user: (c) => (
                          <Link
                            href={`/u/${encodeURIComponent(creator)}`}
                            className="underline"
                          >
                            {c}
                          </Link>
                        ),
                        name: creator,
                      })
                    ) : (
                      t("item.drawnOnSite")
                    )
                  ) : item.imageNonFree ? (
                    <a href={removalLink} className="underline">
                      {t("item.requestRemoval")}
                    </a>
                  ) : item.imageFilePage ? (
                    t.rich("item.imageFrom", {
                      link: (c) => (
                        <a
                          href={item.imageFilePage ?? undefined}
                          className="underline"
                        >
                          {c}
                        </a>
                      ),
                    })
                  ) : (
                    t("item.imageFromPlain")
                  )
                }
              />
            ) : (
              <ItemImage
                src={null}
                alt={item.title}
                className="aspect-video max-h-80 w-full"
              />
            )}

            <div className="flex items-start justify-between gap-3">
              <h1 className="min-w-0 text-3xl font-bold [overflow-wrap:anywhere]">
                {item.title}
              </h1>
              {compound && viewerId && creatorId === viewerId && (
                <span className="ml-auto flex items-center gap-4 pt-1.5">
                  <CompoundEditButton
                    id={item.id}
                    title={item.title}
                    description={item.description ?? ""}
                    imageUrl={item.imageUrl}
                    iconClassName="h-6 w-6"
                  />
                  <CompoundDeleteButton id={item.id} iconClassName="h-6 w-6" />
                </span>
              )}
              {viewerIsAdmin && (
                <ItemAdminMenu
                  itemId={item.id}
                  nsfw={item.nsfw}
                  setBy={nsfwSetBy}
                  setDate={nsfwSetDate}
                />
              )}
            </div>
            {item.description && (
              <p className="text-muted">{item.description}</p>
            )}

            {compound ? (
              <p className="text-xs text-muted">
                {t.rich("item.compoundLine", {
                  hasCreator: creator ? "yes" : "no",
                  hasDate: createdAt ? "yes" : "no",
                  creator: creator ?? "",
                  date: createdAt ? createdAt.slice(0, 10) : "",
                  user: (c) => (
                    <Link
                      href={`/u/${encodeURIComponent(creator ?? "")}`}
                      className="underline"
                    >
                      {c}
                    </Link>
                  ),
                })}
              </p>
            ) : (
              <p className="text-xs text-muted">
                {t.rich("item.fromWikipedia", {
                  link: (c) => (
                    <a
                      href={item.pageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {c}
                    </a>
                  ),
                })}
              </p>
            )}
          </div>

          {compound && madeFrom.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {t("item.madeFrom")}
              </h2>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {madeFrom.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/item/${p.id}`}
                      className="flex flex-col gap-1 no-underline"
                    >
                      <ItemImage
                        src={p.imageUrl}
                        nsfw={p.nsfw}
                        alt={p.title}
                        className="aspect-square w-full"
                      />
                      <span className="truncate text-xs">{p.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {usedIn.length > 0 && (
            <section className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                {t("item.usedIn")}
              </h2>
              <p className="text-sm">
                {usedIn.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ", "}
                    <Link href={`/item/${c.id}`} className="underline">
                      {c.title}
                    </Link>
                  </span>
                ))}
              </p>
            </section>
          )}

          <AddToList
            itemId={id}
            title={item.title}
            imageUrl={item.imageUrl}
            signedIn={Boolean(viewerId)}
            aside={
              <div className="hidden shrink-0 sm:ml-auto sm:not-empty:block">
                <RatingHistogram
                  ratings={ratings}
                  highlight={myRating}
                  hrefBase={`/item/${item.id}/ratings`}
                  compact
                />
              </div>
            }
          />
          <div id="log" className="scroll-mt-4">
            <LogForm
              id={id}
              signedIn={Boolean(viewerId)}
              alreadyLogged={myEntries.length > 0}
            />
          </div>
          <MyEntries entries={myEntries} />
          <div className="sm:hidden">
            <RatingHistogram
              ratings={ratings}
              highlight={myRating}
              action={
                // Shares the item and its histogram as one picture
                <ShareImageButton
                  imageHref={`/item/${item.id}/ratings-image`}
                  fileName={`${item.title}-ratings.png`}
                />
              }
              hrefBase={`/item/${item.id}/ratings`}
            />
          </div>
        </ReviewPictureProvider>
      </div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <ItemLogs
            key={logsKey}
            itemId={id}
            popular={mostLiked.rows}
            recent={recentLogs.rows}
            next={recentLogs.next}
            error={mostLiked.error || recentLogs.error}
            viewerId={viewerId}
            viewer={viewer}
          />
        </div>
        <div className="min-w-0">
          <ItemLists
            itemId={id}
            lists={itemLists.lists}
            next={itemLists.next}
            error={itemLists.error}
            viewerId={viewerId}
            viewer={viewer}
          />
        </div>
      </div>
    </main>
  );
}
