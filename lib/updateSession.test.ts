// ABOUTME: Tests the headers and cookies the proxy sends when it does and doesn't refresh a session.
// ABOUTME: Runs the real Supabase server client against a scripted auth server.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { updateSession } from "./supabase/proxy";

const COOKIE_NAME = "sb-test-auth-token";
const realFetch = globalThis.fetch;

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function session(expiresAt: number) {
  return {
    access_token: `${base64Url({ alg: "HS256" })}.${base64Url({ sub: "user-1", exp: expiresAt })}.signature`,
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: "user-1" },
  };
}

function requestWithSession(expiresAt: number) {
  const cookie = `base64-${base64Url(session(expiresAt))}`;
  return new NextRequest("https://compend.org/", {
    headers: { cookie: `${COOKIE_NAME}=${cookie}` },
  });
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  globalThis.fetch = async (input) => {
    const { pathname } = new URL(input.toString());
    const body =
      pathname === "/auth/v1/token"
        ? session(nowInSeconds() + 3600)
        : { id: "user-1" };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a response carrying a refreshed session can't be stored by a CDN", async () => {
  const response = await updateSession(requestWithSession(nowInSeconds() - 60));

  assert.ok(response.cookies.get(COOKIE_NAME)?.value);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  assert.match(response.headers.get("cache-control") ?? "", /private/);
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("pragma"), "no-cache");
});

test("a response that doesn't touch the session keeps its caching", async () => {
  const response = await updateSession(
    requestWithSession(nowInSeconds() + 3000),
  );

  assert.equal(response.cookies.get(COOKIE_NAME), undefined);
  assert.equal(response.headers.get("cache-control"), null);
});
