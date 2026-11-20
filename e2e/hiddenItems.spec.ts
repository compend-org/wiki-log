// ABOUTME: Hiding an item takes reviews of it away from the person who hid it, until they show it again.
// ABOUTME: hollis hides Capybara from margot's newest review in the seed data, then shows it again from settings.
import { expect, type Page, test } from "@playwright/test";
import { signIn } from "./signIn";

test.beforeEach(async ({ page }) => {
  await signIn(page, "hollis", "password");
  await expect(page).toHaveURL("/");
});

// Shows Capybara again if the test left it hidden, so the shared local
// database ends as it started
test.afterEach(async ({ page }) => {
  await page.goto("/item/Q131538");
  const toggle = page.getByRole("button", {
    name: /^(Hide this item|Show again)$/,
  });
  await expect(toggle).toBeVisible();
  if ((await toggle.textContent()) === "Show again") {
    await toggle.click();
    await expect(toggle).toHaveText("Hide this item");
  }
});

const capybaraReview = (page: Page) =>
  page.getByRole("link", { name: "Open margot's review of Capybara" });

test("hiding an item from a review leaves its reviews out", async ({
  page,
}) => {
  await page.goto("/u/margot/reviews");
  const card = page.locator(".card", { has: capybaraReview(page) });
  await card.getByRole("button", { name: "More" }).click();
  await card.getByRole("button", { name: /Hide Capybara/ }).click();
  await expect(page.getByText("Capybara is hidden.")).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("link", { name: /review of Moby-Dick/ }),
  ).toBeVisible();
  await expect(capybaraReview(page)).toHaveCount(0);

  await page.goto("/settings");
  await page
    .locator("#hidden-items")
    .getByRole("button", { name: "Show again" })
    .click();
  await expect(page.locator("#hidden-items")).toContainText(
    "You haven't hidden any items",
  );

  await page.goto("/u/margot/reviews");
  await expect(capybaraReview(page)).toBeVisible();
});
