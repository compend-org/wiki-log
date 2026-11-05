// ABOUTME: A small "admin" label shown next to a site admin's username.
// ABOUTME: Nudged down so its capitals line up with the username beside it.
export default function AdminBadge() {
  return (
    <span
      title="Site admin"
      className="relative top-0.5 inline-block text-[0.65rem] font-semibold uppercase leading-4 tracking-wider text-[#1b7f3b] [[data-theme=dark]_&]:text-[#5fd08a]"
    >
      admin
    </span>
  );
}
