// ABOUTME: Blocking someone hides their lists from item pages.
// ABOUTME: delphine blocks yuki: the seed has no follows, shares or notifications between them for the block to delete.
import { expect, test } from "@playwright/test";
import { signIn } from "./signIn";

test.beforeEach(async ({ page }) => {
  await signIn(page, "delphine", "password");
  await expect(page).toHaveURL("/");
});

// Unblocks even when the test fails, so the shared local database ends as it started
test.afterEach(async ({ page }) => {
  await page.goto("/u/yuki");
  const block = page.getByRole("button", { name: /^(Block|Unblock)$/ });
  await expect(block).toBeVisible();
  if ((await block.textContent()) === "Unblock") {
    await block.click();
    await expect(block).toHaveText("Block");
  }
});

test("blocking someone hides their lists on item pages", async ({ page }) => {
  const croissant = "/item/Q207832";
  const yukisList = page.getByRole("link", {
    name: "Best breakfasts, ranked",
  });
  await page.goto(croissant);
  await expect(yukisList).toBeVisible();

  await page.goto("/u/yuki");
  await page.getByRole("button", { name: "Block", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Block", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Unblock" })).toBeVisible();

  await page.goto(croissant);
  await expect(
    page.getByRole("heading", { name: "Not in any lists yet" }),
  ).toBeVisible();
  await expect(yukisList).toHaveCount(0);
});
