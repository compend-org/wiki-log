// ABOUTME: Starts Sentry on the server when a Next.js server instance boots.
// ABOUTME: Also reports errors thrown while handling a request.
import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN });
}

export const onRequestError = Sentry.captureRequestError;
