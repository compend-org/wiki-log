// ABOUTME: Someone or something that doesn't exist gets the not found page, with a 404 status.
// ABOUTME: The status tells search engines and link previews the page isn't real.
import { expect, test } from "@playwright/test";

for (const path of ["/u/nobody-by-this-name", "/item/Q999999999999"]) {
  test(`${path} is not found`, async ({ page }) => {
    const response = await page.goto(path);

    await expect(page.getByText("Page not found.")).toBeVisible();
    expect(response?.status()).toBe(404);
  });
}
