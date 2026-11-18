// ABOUTME: Sends product analytics events from the browser and ties them to the signed-in person.
// ABOUTME: Does nothing when no PostHog project token is configured.
import posthog from "posthog-js";
import {
  ANALYTICS_TOKEN,
  type AnalyticsEventArgs,
  type AnalyticsEventName,
} from "@/lib/analytics/analyticsEvents";

// Settles once PostHog has started. PostHog drops calls made before then, so
// every call below waits for it.
let started: Promise<void> = Promise.resolve();

// Holds analytics calls until `start` has started PostHog
export function startAnalytics(start: Promise<void>) {
  started = start;
}

function whenStarted(call: () => void) {
  started.then(call);
}

export function track<K extends AnalyticsEventName>(
  name: K,
  ...[properties]: AnalyticsEventArgs<K>
) {
  if (!ANALYTICS_TOKEN) return;
  whenStarted(() => posthog.capture(name, properties));
}

type PersonProperties = { username: string; is_admin: boolean };

// Links this browser's events to a person by their user id, never their email
export function identifyPerson(userId: string, properties?: PersonProperties) {
  if (!ANALYTICS_TOKEN) return;
  whenStarted(() => posthog.identify(userId, properties));
}

// Records changes to the identified person, like a new username
export function updatePerson(properties: PersonProperties) {
  if (!ANALYTICS_TOKEN) return;
  whenStarted(() => posthog.setPersonProperties(properties));
}

// Starts a fresh anonymous visitor after signing out. An anonymous visitor
// stays as they are.
export function forgetPerson() {
  if (!ANALYTICS_TOKEN) return;
  whenStarted(() => {
    if (posthog.get_property("$user_state") === "identified") posthog.reset();
  });
}
