// ABOUTME: Reaches a list and a review by clicking through someone's profile, as visitors do.
// ABOUTME: Their ids change every time the seed runs, so the tests find them by name.
import { expect, test } from "@playwright/test";

const CAPYBARA_REVIEW =
  "Sits in a hot spring with an orange on its head and asks nothing of anyone.";

test("a list opens from its owner's lists", async ({ page }) => {
  await page.goto("/u/margot/lists");
  await page
    .getByRole("link", { name: "Open the list Food I've eaten" })
    .click();

  await expect(page).toHaveURL(/\/list\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: "Food I've eaten" }),
  ).toBeVisible();
  await expect(page.getByText("Looking forward to the sequel.")).toBeVisible();
});

test("a review opens from its author's reviews, with its comments", async ({
  page,
}) => {
  await page.goto("/u/margot/reviews");
  await page
    .getByRole("link", { name: "Open margot's review of Capybara" })
    .click();

  await expect(page).toHaveURL(/\/u\/margot\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("article").getByText(CAPYBARA_REVIEW),
  ).toBeVisible();
  await expect(
    page.getByText("The orange is doing a lot of the work here."),
  ).toBeVisible();
});
