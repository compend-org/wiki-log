import Link from "next/link";

// "alex shared:", "alex and 2 others shared:", "You shared:". The first name
// links to their profile. "You" has no name to link to, so it stays plain.
export default function SharedLabel({ names }: { names: string[] }) {
  const [first, ...rest] = names;
  if (!first) return null;

  return (
    <span>
      {first === "You" ? (
        "You"
      ) : (
        <Link
          href={`/u/${encodeURIComponent(first)}`}
          className="relative z-10 hover:underline"
        >
          {first}
        </Link>
      )}
      {rest.length > 0 &&
        ` and ${rest.length} ${rest.length === 1 ? "other" : "others"}`}{" "}
      shared:
    </span>
  );
}