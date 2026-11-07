// ABOUTME: Starts Sentry on the server when a Next.js server instance boots.
// ABOUTME: Also reports errors thrown while handling a request.
import * as Sentry from "@sentry/nextjs";

export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    // Sentry starts during each server instance's first request, so that
    // request gets no scope of its own from the HTTP server. Its breadcrumbs
    // and tags would then land on every later error from the instance.
    // Configuring tracing gives every request its own scope when Next.js
    // starts handling it. A rate of 0 sends no traces.
    tracesSampleRate: 0,
    // Request bodies are sent unfiltered. Server action bodies hold
    // passwords and review text, so no bodies are sent.
    dataCollection: { httpBodies: [] },
  });
}

export const onRequestError = Sentry.captureRequestError;
