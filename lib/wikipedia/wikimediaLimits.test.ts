// ABOUTME: Tests how requests wait out the delays Wikimedia asks for,
// ABOUTME: and give up once a wait would run past the deadline.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type Pause, sendWithinDeadline } from "./wikimediaLimits";

function rateLimited(retryAfterSeconds: number): Response {
  return new Response(null, {
    status: 429,
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}

// Answers with each response in turn, counting the requests
function replies(...responses: Response[]) {
  const sender = {
    sent: 0,
    send: async () => responses[sender.sent++],
  };
  return sender;
}

test("waits out a requested delay and sends again", async () => {
  const sender = replies(rateLimited(0.05), new Response("ok"));
  const start = Date.now();
  const res = await sendWithinDeadline(
    sender.send,
    { until: 0 },
    Date.now() + 15000,
  );
  assert.equal(res?.status, 200);
  assert.equal(sender.sent, 2);
  assert.ok(Date.now() - start >= 45);
});

test("keeps retrying while the waits fit before the deadline", async () => {
  const sender = replies(
    rateLimited(0.02),
    rateLimited(0.02),
    new Response("ok"),
  );
  const res = await sendWithinDeadline(
    sender.send,
    { until: 0 },
    Date.now() + 15000,
  );
  assert.equal(res?.status, 200);
  assert.equal(sender.sent, 3);
});

test("returns the refusal at once when the wait would pass the deadline", async () => {
  const sender = replies(rateLimited(60), new Response("ok"));
  const pause: Pause = { until: 0 };
  const start = Date.now();
  const res = await sendWithinDeadline(sender.send, pause, Date.now() + 15000);
  assert.equal(res?.status, 429);
  assert.equal(sender.sent, 1);
  assert.ok(Date.now() - start < 1000);
  assert.ok(pause.until > Date.now() + 50000);
});

test("sends nothing while a shared pause runs past the deadline", async () => {
  const sender = replies(new Response("ok"));
  const res = await sendWithinDeadline(
    sender.send,
    { until: Date.now() + 60000 },
    Date.now() + 15000,
  );
  assert.equal(res, null);
  assert.equal(sender.sent, 0);
});

test("waits for a shared pause that ends before the deadline", async () => {
  const sender = replies(new Response("ok"));
  const start = Date.now();
  const res = await sendWithinDeadline(
    sender.send,
    { until: Date.now() + 50 },
    Date.now() + 15000,
  );
  assert.equal(res?.status, 200);
  assert.ok(Date.now() - start >= 45);
});

test("sends nothing once the deadline has passed", async () => {
  const sender = replies(new Response("ok"));
  const res = await sendWithinDeadline(
    sender.send,
    { until: 0 },
    Date.now() - 100,
  );
  assert.equal(res, null);
  assert.equal(sender.sent, 0);
});

test("gives up on a request still running at the deadline", async () => {
  const start = Date.now();
  const res = await sendWithinDeadline(
    () =>
      new Promise((resolve) =>
        setTimeout(() => resolve(new Response("late")), 1000),
      ),
    { until: 0 },
    Date.now() + 30,
  );
  assert.equal(res, null);
  assert.ok(Date.now() - start < 500);
});

test("gives up on a response body still arriving at the deadline", async () => {
  const start = Date.now();
  const res = await sendWithinDeadline(
    async () => new Response(new ReadableStream({ start() {} })),
    { until: 0 },
    Date.now() + 30,
  );
  assert.equal(res, null);
  assert.ok(Date.now() - start < 500);
});

test("honours a pause another request extends while it waits", async () => {
  const sender = replies(new Response("ok"));
  const pause: Pause = { until: Date.now() + 100 };
  setTimeout(() => {
    pause.until = Date.now() + 1000;
  }, 20);
  const start = Date.now();
  const res = await sendWithinDeadline(sender.send, pause, Date.now() + 200);
  assert.equal(res, null);
  assert.equal(sender.sent, 0);
  assert.ok(Date.now() - start < 500);
});
