// ABOUTME: Tests that the stored session survives failed requests and only ends when the server says so.
// ABOUTME: Runs the real Supabase client against a scripted fetch and an in-memory session store.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createClient } from "@supabase/supabase-js";
import { confirmCurrentUser } from "./confirmCurrentUser";

const STORAGE_KEY = "sb-test-auth-token";
const storedUser = { id: "user-1", email: "stored@example.com" };

function storedSession() {
  return JSON.stringify({
    access_token: "header.payload.signature",
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3000,
    user: storedUser,
  });
}

function setUp(answerUserRequest: () => Promise<Response>, session?: string) {
  const items = new Map<string, string>();
  if (session) items.set(STORAGE_KEY, session);
  const requests: string[] = [];

  const supabase = createClient("https://test.supabase.co", "test-key", {
    auth: {
      storageKey: STORAGE_KEY,
      storage: {
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value),
        removeItem: (key) => void items.delete(key),
      },
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: async (input) => {
        const { pathname } = new URL(input.toString());
        requests.push(pathname);
        if (pathname === "/auth/v1/user") return answerUserRequest();
        return new Response(null, { status: 204 });
      },
    },
  });

  return { supabase, items, requests };
}

function authError(status: number, code: string) {
  return async () =>
    new Response(JSON.stringify({ code, message: code }), {
      status,
      headers: {
        "content-type": "application/json",
        "x-supabase-api-version": "2024-01-01",
      },
    });
}

test("returns the user the server confirms", async () => {
  const confirmed = { id: "user-1", email: "confirmed@example.com" };
  const { supabase } = setUp(
    async () => new Response(JSON.stringify(confirmed), { status: 200 }),
    storedSession(),
  );

  const user = await confirmCurrentUser(supabase);

  assert.equal(user?.email, "confirmed@example.com");
});

test("keeps the session when the request never gets an answer", async () => {
  const { supabase, items, requests } = setUp(async () => {
    throw new TypeError("Load failed");
  }, storedSession());

  const user = await confirmCurrentUser(supabase);

  assert.equal(user?.id, storedUser.id);
  assert.ok(items.has(STORAGE_KEY));
  assert.ok(!requests.includes("/auth/v1/logout"));
});

test("keeps the session when the server has an outage", async () => {
  const { supabase, items, requests } = setUp(
    async () => new Response("{}", { status: 522 }),
    storedSession(),
  );

  const user = await confirmCurrentUser(supabase);

  assert.equal(user?.id, storedUser.id);
  assert.ok(items.has(STORAGE_KEY));
  assert.ok(!requests.includes("/auth/v1/logout"));
});

test("keeps the session when the server is rate limiting", async () => {
  const { supabase, items } = setUp(
    authError(429, "over_request_rate_limit"),
    storedSession(),
  );

  const user = await confirmCurrentUser(supabase);

  assert.equal(user?.id, storedUser.id);
  assert.ok(items.has(STORAGE_KEY));
});

test("forgets the session of an account that no longer exists", async () => {
  const { supabase, items } = setUp(
    authError(403, "user_not_found"),
    storedSession(),
  );

  const user = await confirmCurrentUser(supabase);

  assert.equal(user, null);
  assert.ok(!items.has(STORAGE_KEY));
});

test("forgets a session the server has ended", async () => {
  const { supabase, items } = setUp(
    authError(403, "session_not_found"),
    storedSession(),
  );

  const user = await confirmCurrentUser(supabase);

  assert.equal(user, null);
  assert.ok(!items.has(STORAGE_KEY));
});

test("returns no one when nobody is signed in, without asking the server", async () => {
  const { supabase, requests } = setUp(async () => {
    throw new Error("should not be called");
  });

  const user = await confirmCurrentUser(supabase);

  assert.equal(user, null);
  assert.deepEqual(requests, []);
});
