// ABOUTME: Times written as "5m ago" for the admin pages, which are English only.
// ABOUTME: Kept apart from the site's translated times so admin pages need no translator.
import { createTranslator } from "next-intl";
import { timeAgo } from "@/lib/format";
import messages from "@/messages/en.json";

const t = createTranslator({ locale: "en", messages });

export function adminTimeAgo(time: string, now: number): string {
  return timeAgo(time, now, t, "en");
}
