// ABOUTME: Replying to a reply, as the demo account, names the person replied to in the diary.
// ABOUTME: Uses the seed data, where margot replied to tomasz on her Capybara review; the test deletes its own reply.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.use({ storageState: DEMO_SESSION });

test("a reply to a reply names whose reply it answers", async ({ page }) => {
  const text = `Agreed, from the e2e test ${Date.now()}`;

  await page.goto("/u/margot/reviews");
  await page
    .getByRole("link", { name: "Open margot's review of Capybara" })
    .click();
  // margot's reply sits under tomasz's comment, which starts the thread
  await page
    .getByText("It really is. Without the orange")
    .locator("xpath=ancestor::div[.//button[normalize-space()='Reply']][1]")
    .getByRole("button", { name: "Reply" })
    .click();
  const box = page.getByPlaceholder("Write a reply");
  await box.press("End");
  await box.pressSequentially(text);
  await page
    .locator("form", { has: box })
    .getByRole("button", { name: "Reply" })
    .click();
  // The form closes once the reply is saved
  await expect(box).toBeHidden();

  await page.goto("/activity");
  const card = page.locator(".card", { hasText: text });
  await expect(card).toContainText("You replied to margot");

  await card.getByRole("button", { name: "Delete this reply" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(card).toHaveCount(0);
});
