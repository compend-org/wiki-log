// ABOUTME: Sends product analytics events from the browser and ties them to the signed-in person.
// ABOUTME: Does nothing when no PostHog project token is configured.
import posthog from "posthog-js";
import {
  ANALYTICS_TOKEN,
  type AnalyticsEventArgs,
  type AnalyticsEventName,
} from "@/lib/analyticsEvents";

export function track<K extends AnalyticsEventName>(
  name: K,
  ...[properties]: AnalyticsEventArgs<K>
) {
  if (!ANALYTICS_TOKEN) return;
  posthog.capture(name, properties);
}

type PersonProperties = { username: string; is_admin: boolean };

// Links this browser's events to a person by their user id, never their email
export function identifyPerson(userId: string, properties?: PersonProperties) {
  if (!ANALYTICS_TOKEN) return;
  posthog.identify(userId, properties);
}

// Records changes to the identified person, like a new username
export function updatePerson(properties: PersonProperties) {
  if (!ANALYTICS_TOKEN) return;
  posthog.setPersonProperties(properties);
}

// Starts a fresh anonymous visitor after signing out
export function forgetPerson() {
  if (!ANALYTICS_TOKEN) return;
  posthog.reset();
}
