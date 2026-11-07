// ABOUTME: Starts Sentry and makes translated pages safe before the app becomes interactive.
// ABOUTME: Tracing and session replay stay off, so only errors are sent.
import * as Sentry from "@sentry/nextjs";
import { tolerateTranslatedPage } from "@/lib/translatedPage";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Only report errors thrown from our own bundles. Scripts that browsers and
  // in-app webviews inject into the page (translators, Twitter, Instagram)
  // report the page's URL as their file, so their errors are left out.
  allowUrls: [/\/_next\//],
});

tolerateTranslatedPage(Node.prototype);
