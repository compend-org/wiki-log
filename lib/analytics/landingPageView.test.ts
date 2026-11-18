// ABOUTME: Tests for holding back the landing page view until the page knows who is signed in.
// ABOUTME: Covers holding, sending it as the person known by then, and giving up after a wait.
import assert from "node:assert/strict";
import { mock, test } from "node:test";
import type { CaptureResult } from "posthog-js";
import { holdLandingPageView } from "./landingPageView";

function pageView(
  uuid: string,
  properties: Record<string, unknown>,
): CaptureResult {
  return { uuid, event: "$pageview", properties };
}

// The wait for who is signed in runs on a pretend clock
mock.timers.enable({ apis: ["setTimeout"] });

// A held page view as it comes back out, carrying the person changes of the
// moment it was sent
function sentPageView(held: CaptureResult): CaptureResult {
  return { ...held, $set: undefined, $set_once: undefined };
}

const landing = pageView("landing", {
  distinct_id: "anonymous-visitor",
  $is_identified: false,
  $process_person_profile: false,
  $current_url: "https://example.com/notifications",
  $referrer: "https://news.example.com/",
});

// Plays PostHog's part: sends each held page view through beforeSend again,
// as the visitor known at that moment, and keeps what comes out
function hold(sentAs: Record<string, unknown>) {
  const sent: (CaptureResult | null)[] = [];
  const landingPageView = holdLandingPageView((held) => {
    sent.push(
      landingPageView.beforeSend(
        pageView(held.uuid, {
          ...sentAs,
          $current_url: "https://example.com/somewhere-else",
        }),
      ),
    );
  });
  return { landingPageView, sent };
}

test("holds the landing page view and sends it as the signed-in person", () => {
  const { landingPageView, sent } = hold({
    distinct_id: "user-1",
    $is_identified: true,
    $process_person_profile: true,
  });

  assert.equal(landingPageView.beforeSend(landing), null);
  landingPageView.release();

  assert.deepEqual(sent, [
    sentPageView(
      pageView("landing", {
        distinct_id: "user-1",
        $is_identified: true,
        $process_person_profile: true,
        $current_url: "https://example.com/notifications",
        $referrer: "https://news.example.com/",
      }),
    ),
  ]);
});

test("lets other events and later page views through", () => {
  const { landingPageView } = hold({ distinct_id: "user-1" });
  const named = { uuid: "e", event: "feed_tab_opened", properties: {} };

  landingPageView.beforeSend(landing);
  assert.equal(landingPageView.beforeSend(named), named);
  landingPageView.release();
  const later = pageView("later", {});
  assert.equal(landingPageView.beforeSend(later), later);
});

test("doesn't hold the landing page view once who is signed in is known", () => {
  const { landingPageView, sent } = hold({ distinct_id: "user-1" });

  landingPageView.release();
  assert.equal(landingPageView.beforeSend(landing), landing);
  assert.deepEqual(sent, []);
});

test("sends the landing page view anonymously after waiting too long", () => {
  const { landingPageView, sent } = hold({
    distinct_id: "anonymous-visitor",
    $is_identified: false,
    $process_person_profile: false,
  });

  landingPageView.beforeSend(landing);
  mock.timers.tick(10_000);
  landingPageView.release();

  assert.deepEqual(sent, [sentPageView(landing)]);
});
