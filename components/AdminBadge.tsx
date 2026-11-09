// ABOUTME: A small "admin" label shown next to a site admin's username.
// ABOUTME: In flex rows it is nudged down to line up with the username; in running text it sits on the baseline.
export default function AdminBadge({ inline = false }: { inline?: boolean }) {
  return (
    <span
      title="Site admin"
      className={`relative inline-block text-[0.65rem] font-semibold uppercase leading-4 tracking-wider text-[#1b7f3b] [[data-theme=dark]_&]:text-[#5fd08a] ${inline ? "" : "top-0.5"}`}
    >
      admin
    </span>
  );
}
