// ABOUTME: The home page's feed tabs, signed out: each one is selected and kept in the address.
// ABOUTME: Trending and Digest depend on how old the seed is, so only Everyone's reviews are checked.
import { expect, test } from "@playwright/test";

test("switching between the feed's tabs", async ({ page }) => {
  await page.goto("/");

  for (const [name, tab] of [
    ["Trending", "trending"],
    ["Digest", "digest"],
    ["Everyone", "everyone"],
  ]) {
    const button = page.getByRole("tab", { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveURL(`/?tab=${tab}`);
  }
  // Tabs shown before stay on the page, hidden, so only the visible one counts
  await expect(
    page
      .getByText("Over in nine seconds and then my hands shook until lunch.")
      .filter({ visible: true }),
  ).toBeVisible();
});
