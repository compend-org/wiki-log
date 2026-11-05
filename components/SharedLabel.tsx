// ABOUTME: The "alex shared:" line above a shared log or list in the feed.
// ABOUTME: The first sharer's name links to their profile and carries the admin badge.
import UserName from "@/components/UserName";

// Someone who shared a log or list. `name` is "You" when it's the viewer, and
// null when their profile couldn't be read.
export type Sharer = { id: string; name: string | null };

// "alex shared:", "alex and 2 others shared:", "You shared:". "You" has no
// name to link to, so it stays plain. Renders as sibling elements so it can
// sit inside a flex row.
export default function SharedLabel({ sharers }: { sharers: Sharer[] }) {
  const [first, ...rest] = sharers;
  if (!first) return null;

  return (
    <>
      {first.name === "You" ? (
        <span>You</span>
      ) : (
        <UserName userId={first.id} username={first.name} />
      )}
      {rest.length > 0 && (
        <span>
          and {rest.length} {rest.length === 1 ? "other" : "others"}
        </span>
      )}
      <span>shared:</span>
    </>
  );
}
