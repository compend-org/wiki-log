// ABOUTME: Tests what Sentry receives when a Supabase request fails.
// ABOUTME: Checks the event title and grouping don't depend on minified function names.
import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import * as Sentry from "@sentry/nextjs";
import { reportFailedResponses } from "./supabase/reportFailedResponses";

const sent: Sentry.ErrorEvent[] = [];
Sentry.init({
  dsn: "https://public@example.invalid/1",
  beforeSend(event) {
    sent.push(event);
    return null;
  },
});

afterEach(() => {
  mock.restoreAll();
  sent.length = 0;
});

test("a failed request is reported under a fixed error type and returned unchanged", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json(
      { code: "42501", message: "permission denied for table likes" },
      { status: 401 },
    ),
  );

  const response = await reportFailedResponses(
    "https://test.supabase.co/rest/v1/likes",
    { method: "POST" },
  );
  await Sentry.flush();

  assert.equal(response.status, 401);
  assert.equal(sent.length, 1);
  const [event] = sent;
  const error = event.exception?.values?.[0];
  assert.equal(error?.type, "SupabaseError");
  assert.equal(
    error?.value,
    "Supabase POST likes: permission denied for table likes",
  );
  assert.equal(event.level, "error");
  assert.deepEqual(event.fingerprint, ["supabase", "likes", "42501"]);
  assert.equal(event.tags?.table, "likes");
  assert.equal(event.tags?.sql_code, "42501");
  assert.equal(event.extra?.status, 401);
});

test("a successful request is not reported", async () => {
  mock.method(globalThis, "fetch", async () => Response.json([]));

  await reportFailedResponses("https://test.supabase.co/rest/v1/likes");
  await Sentry.flush();

  assert.equal(sent.length, 0);
});

test("asking for a page past the end of a list is not reported", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json(
      { code: "PGRST103", message: "Requested range not satisfiable" },
      { status: 416 },
    ),
  );

  const response = await reportFailedResponses(
    "https://test.supabase.co/rest/v1/list_items?list_id=eq.x",
  );
  await Sentry.flush();

  assert.equal(response.status, 416);
  assert.equal(sent.length, 0);
});

test("an auth outage is reported under its route, without the user id", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json(
      {
        code: 504,
        error_code: "request_timeout",
        msg: "Processing this request timed out, please retry after a moment.",
      },
      { status: 504 },
    ),
  );

  const response = await reportFailedResponses(
    "https://test.supabase.co/auth/v1/admin/users/35255498-ad17-42a2-9fed-07ebb4afd72f",
    { method: "DELETE" },
  );
  await Sentry.flush();

  assert.equal(response.status, 504);
  assert.equal(sent.length, 1);
  const [event] = sent;
  assert.equal(
    event.exception?.values?.[0]?.value,
    "Supabase DELETE auth/admin/users: Processing this request timed out, please retry after a moment.",
  );
  assert.deepEqual(event.fingerprint, [
    "supabase",
    "auth/admin/users",
    "request_timeout",
  ]);
});

test("a storage outage is reported under its bucket, without the file path", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json(
      { statusCode: "500", error: "internal", message: "Internal error" },
      { status: 500 },
    ),
  );

  await reportFailedResponses(
    "https://test.supabase.co/storage/v1/object/avatars/35255498-ad17-42a2-9fed-07ebb4afd72f/me.png",
    { method: "DELETE" },
  );
  await Sentry.flush();

  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].fingerprint, [
    "supabase",
    "storage/object/avatars",
    "internal",
  ]);
});

test("auth and storage errors the app shows the person are not reported", async () => {
  mock.method(globalThis, "fetch", async () =>
    Response.json(
      { code: 400, error_code: "invalid_credentials", msg: "Invalid login" },
      { status: 400 },
    ),
  );

  await reportFailedResponses(
    "https://test.supabase.co/auth/v1/token?grant_type=password",
    { method: "POST" },
  );
  await reportFailedResponses(
    "https://test.supabase.co/storage/v1/object/avatars/x/me.png",
  );
  await Sentry.flush();

  assert.equal(sent.length, 0);
});
