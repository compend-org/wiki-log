// ABOUTME: Tests that the proxy only lets admins reach the admin pages, and answers everyone else with a 404.
// ABOUTME: Runs the real Supabase server client against a scripted auth server and database.
import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { NextRequest } from "next/server";
import { adminOnly, isAdminPath } from "./supabase/proxy";

const COOKIE_NAME = "sb-test-auth-token";
const realFetch = globalThis.fetch;

// Who the scripted database has as admins, and how it answers a lookup
let adminIds: string[];
let adminLookup: (url: URL) => Response;

function base64Url(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

function session(expiresAt: number) {
  return {
    access_token: `${base64Url({ alg: "HS256" })}.${base64Url({ sub: "user-1", exp: expiresAt })}.c2lnbmF0dXJl`,
    refresh_token: "refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: "user-1" },
  };
}

function signedInRequest(expiresAt = nowInSeconds() + 3000) {
  const cookie = `base64-${base64Url(session(expiresAt))}`;
  return new NextRequest("https://compend.org/admin/reports", {
    headers: { cookie: `${COOKIE_NAME}=${cookie}` },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isServedMissing(response: Response) {
  return (
    response.headers
      .get("x-middleware-rewrite")
      ?.endsWith("/admin-page-that-does-not-exist") ?? false
  );
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-key";
  adminIds = ["user-1"];
  adminLookup = (url) => {
    // Answers the way the database does: only rows matching the filter, so a
    // lookup that forgets to ask about the viewer wouldn't get a yes
    const asked = url.searchParams.get("user_id")?.replace(/^eq\./, "");
    return json(
      adminIds.filter((id) => id === asked).map((id) => ({ user_id: id })),
    );
  };

  globalThis.fetch = async (input) => {
    const url = new URL(input.toString());
    const { pathname } = url;
    if (pathname === "/rest/v1/admins") return adminLookup(url);
    if (pathname === "/auth/v1/token") {
      return json(session(nowInSeconds() + 3600));
    }
    return json({ id: "user-1" });
  };
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

test("an admin gets through, and the page can't be stored", async () => {
  const response = await adminOnly(signedInRequest());

  assert.equal(isServedMissing(response), false);
  assert.equal(response.headers.get("x-middleware-next"), "1");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("a signed-out visitor gets the 404", async () => {
  const response = await adminOnly(
    new NextRequest("https://compend.org/admin/reports"),
  );

  assert.equal(isServedMissing(response), true);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("a signed-in non-admin gets the 404, even with other admins around", async () => {
  adminIds = ["someone-else"];
  assert.equal(isServedMissing(await adminOnly(signedInRequest())), true);
});

test("a failed admin lookup gets the 404", async () => {
  adminLookup = () => json({ message: "database is down" }, 500);
  assert.equal(isServedMissing(await adminOnly(signedInRequest())), true);

  adminLookup = () => {
    throw new TypeError("fetch failed");
  };
  assert.equal(isServedMissing(await adminOnly(signedInRequest())), true);
});

test("someone turned away keeps a session refreshed along the way", async () => {
  adminIds = [];

  const response = await adminOnly(signedInRequest(nowInSeconds() - 60));

  assert.equal(isServedMissing(response), true);
  assert.ok(response.cookies.get(COOKIE_NAME)?.value);
});

test("only the admin section counts as an admin path", () => {
  assert.equal(isAdminPath("/admin"), true);
  assert.equal(isAdminPath("/admin/reports"), true);
  assert.equal(isAdminPath("/admin/reports/some-id"), true);
  assert.equal(isAdminPath("/administrator"), false);
  assert.equal(isAdminPath("/u/admin"), false);
  assert.equal(isAdminPath("/"), false);
});
