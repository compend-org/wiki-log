// ABOUTME: Tests for the login and sign-up addresses that return visitors to where they were.
// ABOUTME: Covers the plain, returning and unsafe cases of each.
import assert from "node:assert/strict";
import { test } from "node:test";
import { loginHref, signUpHref } from "./redirect";

test("signUpHref opens the sign-up form and returns to the page", () => {
  assert.equal(
    signUpHref("/item/Q89"),
    "/login?next=%2Fitem%2FQ89&mode=signup",
  );
});

test("signUpHref has no next for the home page or an unsafe path", () => {
  assert.equal(signUpHref("/"), "/login?mode=signup");
  assert.equal(signUpHref("//elsewhere.com"), "/login?mode=signup");
});

test("loginHref opens the sign-in form", () => {
  assert.equal(loginHref("/u/leo"), "/login?next=%2Fu%2Fleo");
});
