// ABOUTME: Signs in as the seed's demo account once and saves the session.
// ABOUTME: The signed-in tests start from that session instead of signing in themselves.
import { expect, test as setup } from "@playwright/test";
import { DEMO_SESSION, signIn } from "./signIn";

setup("sign in as demo", async ({ page }) => {
  await signIn(page, "demo", "password");
  await expect(
    page.getByRole("link", { name: "demo's profile" }),
  ).toBeVisible();
  await page.context().storageState({ path: DEMO_SESSION });
});
