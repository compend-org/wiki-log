// ABOUTME: A small "admin" label shown next to a site admin's username.
// ABOUTME: Its letters sit on the baseline of the text beside it, in running text and in flex rows alike.
export default function AdminBadge() {
  // The outer box takes the surrounding font, so in a flex row it is centred
  // like the text beside it, and the label sits on that text's baseline.
  // The label is positioned so it paints above a card's full-card link,
  // which keeps its "Site admin" tooltip reachable.
  return (
    <span>
      <span
        title="Site admin"
        className="relative text-[0.65rem] font-semibold uppercase leading-none tracking-wider text-[#1b7f3b] [[data-theme=dark]_&]:text-[#5fd08a]"
      >
        admin
      </span>
    </span>
  );
}
