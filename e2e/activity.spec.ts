// ABOUTME: Someone else's activity page, looked at while signed out.
// ABOUTME: Uses the seed data, where margot's newest diary entry is a reply to tomasz.
import { expect, test } from "@playwright/test";

test("a diary shows who each reply answers", async ({ page }) => {
  await page.goto("/u/margot/activity");

  await expect(
    page.getByRole("heading", { name: "margot's activity" }),
  ).toBeVisible();
  const reply = page.locator(".card", {
    hasText: "It really is. Without the orange",
  });
  await expect(reply).toContainText("margot replied to tomasz");
  await expect(reply.getByRole("link", { name: "tomasz" })).toHaveAttribute(
    "href",
    "/u/tomasz",
  );
});
