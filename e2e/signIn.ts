// ABOUTME: Signs in through the sign-in page, and says where the demo account's saved session is kept.
// ABOUTME: Every seed account's password is "password" (supabase/seed.sql).
import type { Page } from "@playwright/test";

// The demo account's session, saved by auth.setup.ts for the signed-in tests
export const DEMO_SESSION = "e2e/.auth/demo.json";

export async function signIn(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByPlaceholder("Email or username").fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
