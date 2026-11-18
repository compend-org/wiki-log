// ABOUTME: Holds back the page view sent when a page loads until the page knows who is signed in,
// ABOUTME: so a signed-in visitor's landing page counts as theirs rather than an anonymous visitor's.
import type { CaptureResult } from "posthog-js";

// How long a held page view waits for the page to say who is signed in
const LANDING_PAGE_VIEW_WAIT_MS = 10_000;

// Properties that say who sent an event. A held page view takes these from
// the moment it's sent; everything else stays as it was when the page loaded.
const IDENTITY_PROPERTIES = [
  "distinct_id",
  "$user_state",
  "$is_identified",
  "$process_person_profile",
  "$anon_distinct_id",
];

// `send` captures a page view with the held one's uuid and timestamp. `leaving`
// is true when the page is being closed, so it must go out straight away.
type SendHeldPageView = (held: CaptureResult, leaving: boolean) => void;

export function holdLandingPageView(send: SendHeldPageView) {
  let state: "waiting" | "holding" | "released" = "waiting";
  let held: CaptureResult | null = null;

  function release(leaving = false) {
    const wasHolding = state === "holding";
    state = "released";
    if (wasHolding && held) send(held, leaving);
    held = null;
  }

  // Runs on every event before PostHog sends it
  function beforeSend(event: CaptureResult): CaptureResult | null {
    if (held && event.uuid === held.uuid) {
      const properties = { ...held.properties };
      for (const key of IDENTITY_PROPERTIES) {
        if (key in event.properties) properties[key] = event.properties[key];
        else delete properties[key];
      }
      return {
        ...held,
        properties,
        $set: event.$set,
        $set_once: event.$set_once,
      };
    }
    if (state !== "waiting" || event.event !== "$pageview") return event;

    state = "holding";
    held = event;
    setTimeout(() => release(), LANDING_PAGE_VIEW_WAIT_MS);
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", () => release(true), { once: true });
    }
    return null;
  }

  return { beforeSend, release };
}
