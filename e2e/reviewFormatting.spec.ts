// ABOUTME: Formatting a review with the bar above the review box, as the demo account.
// ABOUTME: The TeX test deletes its own comment, so the shared local database ends as it started.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.use({ storageState: DEMO_SESSION });

// Selects `words` in the review box
async function select(box: import("@playwright/test").Locator, words: string) {
  await box.evaluate((el: HTMLTextAreaElement, words) => {
    const at = el.value.indexOf(words);
    el.focus();
    el.setSelectionRange(at, at + words.length);
  }, words);
}

test("bolds text and links it to a web page", async ({ page }) => {
  await page.goto("/item/Q131538");
  const box = page.locator("#log textarea");
  await box.fill("Floats in hot springs. Read the field notes.");

  await select(box, "hot springs");
  await page.getByRole("button", { name: "Bold" }).click();
  await expect(box).toHaveValue(
    "Floats in **hot springs**. Read the field notes.",
  );

  await select(box, "field notes");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Link to a web page" })
    .fill("example.com/capybaras");
  await page.keyboard.press("Enter");
  // The link shows as its words while writing
  await expect(box).toHaveValue(
    "Floats in **hot springs**. Read the field notes.",
  );
  await expect(
    page.getByRole("textbox", { name: "Link to a web page" }),
  ).toBeHidden();

  // A link typed out in markdown shrinks to its words too
  await box.evaluate((el: HTMLTextAreaElement) =>
    el.setSelectionRange(el.value.length, el.value.length),
  );
  await box.pressSequentially(" [More](https://example.com/more)");
  await expect(box).toHaveValue(
    "Floats in **hot springs**. Read the field notes. More",
  );
});

test.describe("TeX", () => {
  // demo's own review, so the comment notifies no one. It has no other
  // comments, since each comment on a page draws its own copy of the delete
  // dialog.
  async function openReview(page: import("@playwright/test").Page) {
    await page.goto("/u/demo/reviews");
    await page
      .getByRole("link", { name: "Open demo's review of Sonic Youth" })
      .click();
    await expect(page.getByPlaceholder("Add a comment")).toBeVisible();
  }
  const comment = (page: import("@playwright/test").Page) =>
    page
      .locator("div")
      .filter({ hasText: "Pays $5 for" })
      .filter({ has: page.getByRole("button", { name: "Delete" }) })
      .last();

  // Deletes the comment even when the test fails, so the shared local
  // database ends as it started
  test.afterEach(async ({ page }) => {
    await openReview(page);
    if ((await comment(page).count()) === 0) return;
    await comment(page).getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(comment(page)).toHaveCount(0);
  });

  test("shows math between $$, and a single $ as a dollar sign", async ({
    page,
  }) => {
    await openReview(page);
    await page
      .getByPlaceholder("Add a comment")
      .fill("Pays $5 for $$\\frac{1}{2}$$ a cannoli.\n\n$$\nE = mc^2\n$$");
    await page.getByRole("button", { name: "Comment", exact: true }).click();

    // Shown both right after posting and as the page first loads
    for (const reload of [false, true]) {
      if (reload) await page.reload();
      await expect(comment(page)).toContainText("Pays $5 for");
      await expect(comment(page).locator(".katex")).toHaveCount(2);
      await expect(comment(page).locator(".katex-display")).toHaveCount(1);
      await expect(comment(page).locator(".katex-error")).toHaveCount(0);
    }
  });
});
