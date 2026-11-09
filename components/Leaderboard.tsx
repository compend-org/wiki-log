// ABOUTME: One leaderboard on the Leaderboards page: a ranked list of items.
// ABOUTME: Picks the board named in the address and shows it with links to the others.
import Link from "next/link";
import { connection } from "next/server";
import ItemImage from "@/components/ItemImage";
import { getLeaderboard } from "@/lib/leaderboardData";
import { LEADERBOARDS } from "@/lib/leaderboards";

export default async function Leaderboard({
  searchParams,
}: {
  searchParams: Promise<{ board?: string }>;
}) {
  await connection();
  const { board: requested } = await searchParams;

  if (LEADERBOARDS.length === 0) {
    return <p className="py-12 text-center text-muted">No leaderboards yet.</p>;
  }

  // An unknown name shows the first leaderboard
  const board =
    LEADERBOARDS.find((b) => b.slug === requested) ?? LEADERBOARDS[0];
  const result = await getLeaderboard(board.slug);
  const entries = result?.entries ?? [];

  return (
    <>
      {LEADERBOARDS.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Leaderboards">
          {LEADERBOARDS.map((b) => (
            <Link
              key={b.slug}
              href={`/leaderboards?board=${encodeURIComponent(b.slug)}`}
              aria-current={b.slug === board.slug ? "page" : undefined}
              className={`border px-3 py-1 text-sm ${
                b.slug === board.slug
                  ? "border-accent text-accent"
                  : "border-line text-muted hover:border-accent/60"
              }`}
            >
              {b.title}
            </Link>
          ))}
        </nav>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{board.title}</h2>
          {board.description && (
            <p className="text-sm text-muted">{board.description}</p>
          )}
        </div>

        {result?.error && <p className="text-danger">{result.error}</p>}

        {!result?.error && entries.length === 0 && (
          <p className="py-8 text-center text-muted">
            Nothing here yet. Items need at least {board.minRatings ?? 3}{" "}
            ratings to appear.
          </p>
        )}

        <ol className="flex flex-col gap-2">
          {entries.map((entry, index) => (
            <li key={entry.itemId}>
              <Link
                href={`/item/${entry.itemId}`}
                className="card flex items-center gap-4 p-3 hover:border-accent/60"
              >
                <span className="w-8 shrink-0 text-right text-lg font-semibold tabular-nums text-muted">
                  {index + 1}
                </span>
                <ItemImage
                  src={entry.imageUrl}
                  alt={entry.title}
                  className="h-14 w-14 shrink-0 rounded"
                  sourceWidth={250}
                />
                <span className="min-w-0 flex-1 break-words font-semibold">
                  {entry.title}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-semibold">
                    {entry.average.toFixed(2)}
                  </span>
                  <span className="block text-xs text-muted">
                    {entry.count} {entry.count === 1 ? "rating" : "ratings"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
