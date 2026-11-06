// ABOUTME: Starts Sentry in the browser before the app becomes interactive.
// ABOUTME: Tracing and session replay stay off, so only errors are sent.
import * as Sentry from "@sentry/nextjs";

Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
