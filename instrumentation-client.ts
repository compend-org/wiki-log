// ABOUTME: Starts Sentry, PostHog analytics, and makes translated pages safe before the app becomes interactive.
// ABOUTME: Sentry sends only errors; PostHog sends page views and named events, keeping nothing in cookies.
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { ANALYTICS_PROXY_PATH, ANALYTICS_TOKEN } from "@/lib/analyticsEvents";
import { IGNORED_BROWSER_ERRORS } from "@/lib/ignoredBrowserErrors";
import { tolerateTranslatedPage } from "@/lib/translatedPage";

if (ANALYTICS_TOKEN) {
  posthog.init(ANALYTICS_TOKEN, {
    api_host: ANALYTICS_PROXY_PATH,
    ui_host: "https://us.posthog.com",
    defaults: "2026-08-30",
    // Kept in memory only, so the site sets no analytics cookies or storage
    persistence: "memory",
    person_profiles: "identified_only",
    // Each page load starts as a new anonymous visitor, so signing in links
    // events to the person without merging that visitor into them. Merging
    // would add an id to the person on every visit, until PostHog's limit.
    reuseAnonymousId: true,
    // Page views and the named events in lib/analyticsEvents.ts only
    autocapture: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
  });
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Only report errors thrown from our own bundles. Scripts that browsers and
  // in-app webviews inject into the page (translators, Twitter, Instagram)
  // report the page's URL as their file, so their errors are left out.
  allowUrls: [/\/_next\//],
  ignoreErrors: IGNORED_BROWSER_ERRORS,
  // Server action requests carry passwords and review text in their bodies
  dataCollection: { httpBodies: [] },
});

tolerateTranslatedPage(Node.prototype);
