// ABOUTME: Formatting a review with the bar above the review box, as the demo account.
// ABOUTME: Nothing is saved, so the shared local database is left as it was.
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
