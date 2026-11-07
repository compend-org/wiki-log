// ABOUTME: Starts Sentry and makes translated pages safe before the app becomes interactive.
// ABOUTME: Tracing and session replay stay off, so only errors are sent.
import * as Sentry from "@sentry/nextjs";
import { tolerateTranslatedPage } from "@/lib/translatedPage";

Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });

tolerateTranslatedPage(Node.prototype);
