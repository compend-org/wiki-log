// ABOUTME: The "alex shared:" line above a shared log or list in the feed.
// ABOUTME: The first sharer's name links to their profile and carries the admin badge.
import { useTranslations } from "next-intl";
import UserName from "@/components/people/UserName";

// Someone who shared a log or list. `name` is "You" when it's the viewer, and
// null when their profile couldn't be read.
export type Sharer = { id: string; name: string | null };

// "alex shared:", "alex and 2 others shared:", "You shared:". "You" has no
// name to link to, so it stays plain. Renders as sibling elements so it can
// sit inside a flex row.
export default function SharedLabel({ sharers }: { sharers: Sharer[] }) {
  const t = useTranslations();
  const [first, ...rest] = sharers;
  if (!first) return null;

  return (
    <>
      {first.name === "You" ? (
        <span>{t("common.you")}</span>
      ) : (
        <UserName userId={first.id} username={first.name} />
      )}
      {rest.length > 0 && (
        <span>{t("logs.shared.andOthers", { count: rest.length })}</span>
      )}
      <span>{t("logs.shared.shared")}</span>
    </>
  );
}
