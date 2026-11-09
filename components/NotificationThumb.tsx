// ABOUTME: The square picture at the right of a notification, showing what it is about.
// ABOUTME: An item's image, a mosaic of a list's first items, or a new follower's avatar.
import Avatar from "@/components/Avatar";
import ItemImage from "@/components/ItemImage";
import type { Thumb } from "@/lib/feedData";
import { firstLetter } from "@/lib/format";

export type NotificationSubject =
  | { kind: "item"; item: Thumb }
  | { kind: "list"; title: string; items: Thumb[] }
  | { kind: "person"; username: string; avatarPath: string | null };

// The most items a list's mosaic has room for
export const MOSAIC_SIZE = 4;

// In pixels, not rem, to match the avatar, whose size is always in pixels
const SIZE = "h-[56px] w-[56px] shrink-0";

function Single({ title, image }: { title: string; image: string | null }) {
  return (
    <ItemImage
      src={image}
      alt=""
      placeholder={firstLetter(title)}
      className={SIZE}
      sourceWidth={120}
    />
  );
}

export default function NotificationThumb({
  subject,
}: {
  subject: NotificationSubject;
}) {
  if (subject.kind === "person") {
    return (
      <Avatar name={subject.username} path={subject.avatarPath} size={56} />
    );
  }

  if (subject.kind === "item") {
    return <Single title={subject.item.title} image={subject.item.image_url} />;
  }

  const { title, items } = subject;
  if (items.length === 0) return <Single title={title} image={null} />;
  if (items.length === 1) {
    return <Single title={items[0].title} image={items[0].image_url} />;
  }

  // Two or three items leave gaps in a 2×2 grid, so some tiles take a full
  // column to keep the square filled
  const isTall = (i: number) =>
    items.length === 2 || (items.length === 3 && i === 0);

  return (
    <div className={`grid grid-cols-2 grid-rows-2 gap-px ${SIZE}`}>
      {items.map((item, i) => (
        <ItemImage
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed-order list whose entries can repeat
          key={i}
          src={item.image_url}
          alt=""
          placeholder={firstLetter(item.title)}
          ratio={isTall(i) ? 0.5 : 1}
          className={`h-full min-h-0 w-full min-w-0 ${isTall(i) ? "row-span-2" : ""}`}
          sourceWidth={120}
        />
      ))}
    </div>
  );
}
