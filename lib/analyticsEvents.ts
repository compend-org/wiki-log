// ABOUTME: Every product analytics event the site sends, with the properties each one carries.
// ABOUTME: Properties never include anything people type, like reviews, comments or bios.

type Target = "log" | "list";
type NoProperties = Record<string, never>;

export type AnalyticsEvents = {
  // Accounts
  signed_up: NoProperties;
  signup_failed: { reason: "username_taken" | "rate_limited" | "other" };
  email_confirmed: NoProperties;
  signed_in: { method: "username" | "email" };
  signin_failed: { reason: "invalid" | "unconfirmed" };
  signed_out: NoProperties;
  password_reset_requested: NoProperties;
  password_reset_completed: NoProperties;
  verification_email_resent: NoProperties;
  account_deleted: NoProperties;

  // Logging items
  item_logged: {
    item_id: string;
    rating: number | null;
    has_review: boolean;
    review_length: number;
    first_time: boolean;
  };
  log_edited: { has_rating: boolean; has_review: boolean };
  log_deleted: NoProperties;
  favourite_set: { position: number };
  favourite_removed: { position: number };

  // Lists
  list_created: { item_count: number; ranked: boolean };
  list_edited: { item_count: number; ranked: boolean };
  list_deleted: NoProperties;
  list_item_added: NoProperties;
  list_item_removed: NoProperties;
  list_reordered: NoProperties;

  // Social
  user_followed: { follows_you: boolean };
  user_unfollowed: NoProperties;
  liked: { target: Target | "comment" };
  unliked: { target: Target | "comment" };
  comment_posted: { target: Target; is_reply: boolean; length: number };
  comment_deleted: { target: Target };
  shared_to_followers: { target: Target };
  unshared: { target: Target };
  pinned: { target: Target };
  unpinned: { target: Target };
  share_image_created: { method: "share_sheet" | "download" };

  // Finding things to read
  feed_tab_opened: { tab: string };
  // page is the page number just loaded, showing how far people scroll
  feed_more_loaded: { feed: string; page: number };
  daily_pick_clicked: { kind: "popular" | "unpopular" };
  notification_clicked: { type: string };

  // Profile and settings
  profile_updated: { field: "username" | "bio" | "avatar" };
  theme_changed: { theme: string };

  // Safety
  report_submitted: {
    target: "log" | "list" | "comment" | "list_comment" | "profile";
    reason: string;
  };
  user_blocked: NoProperties;
  user_unblocked: NoProperties;
};

export type AnalyticsEventName = keyof AnalyticsEvents;

// Events without properties are sent with just their name
export type AnalyticsEventArgs<K extends AnalyticsEventName> =
  AnalyticsEvents[K] extends NoProperties ? [] : [AnalyticsEvents[K]];

// The project token is public; without it nothing is sent, as in local development
export const ANALYTICS_TOKEN = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

// PostHog's US cloud, where events are received and its scripts are served from
export const ANALYTICS_INGEST_HOST = "https://us.i.posthog.com";
export const ANALYTICS_ASSETS_HOST = "https://us-assets.i.posthog.com";
// The path on this site that forwards to PostHog, so ad blockers don't drop events
export const ANALYTICS_PROXY_PATH = "/ingest";
