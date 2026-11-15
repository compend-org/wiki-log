// ABOUTME: Sends product analytics events from the server, for actions that never reach a browser page.
// ABOUTME: Events are delivered after the response is sent; nothing is sent without a project token.
import { after } from "next/server";
import { PostHog } from "posthog-node";
import {
  ANALYTICS_INGEST_HOST,
  ANALYTICS_TOKEN,
  type AnalyticsEventArgs,
  type AnalyticsEventName,
} from "@/lib/analyticsEvents";

export function trackForPerson<K extends AnalyticsEventName>(
  userId: string,
  name: K,
  ...[properties]: AnalyticsEventArgs<K>
) {
  if (!ANALYTICS_TOKEN) return;
  // Server instances are short-lived, so each event is sent on its own
  const client = new PostHog(ANALYTICS_TOKEN, {
    host: ANALYTICS_INGEST_HOST,
    flushAt: 1,
    flushInterval: 0,
  });
  client.capture({ distinctId: userId, event: name, properties });
  after(() => client.shutdown());
}
