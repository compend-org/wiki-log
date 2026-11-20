// ABOUTME: Signing in with a wrong and then the right password, and signing out again.
// ABOUTME: Signs in as the seed's demo account in a fresh browser, not the saved session.
import { expect, test } from "@playwright/test";
import { signIn } from "./signIn";

test("signing in and out", async ({ page }) => {
  await signIn(page, "demo", "wrong password");
  await expect(page.getByText("Invalid sign-in credentials")).toBeVisible();

  await signIn(page, "demo", "password");
  await expect(page).toHaveURL("/");
  const profile = page.getByRole("link", { name: "demo's profile" });
  await expect(profile).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(profile).toHaveCount(0);
});
