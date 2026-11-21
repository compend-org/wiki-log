// ABOUTME: Pages showing a username up to the 30-character limit still fit a phone's width.
// ABOUTME: Uses the seed's long-named account on Saturn (Q193), and margot's pages with a long name put in.
import { expect, type Page, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 800 } });

// A real username of 29 letters with no spaces, which can't break anywhere
const LONG_NAME = "AgonizinglyUglyYellowBballCap";

async function expectNoSideScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
}

test("an item's reviews fit beside a long username", async ({ page }) => {
  await page.goto("/item/Q193");
  await expect(
    page.getByRole("link", {
      name: "ThisUsernameIsThirtyCharsLong!",
      exact: true,
    }),
  ).toBeVisible();
  await expectNoSideScroll(page);
});

// The seed's long name has a "!", which sign up doesn't allow, so its own
// profile doesn't open; margot's headings are given a long name instead
for (const { path, heading } of [
  { path: "/u/margot", heading: "margot" },
  { path: "/u/margot/activity", heading: "margot's activity" },
]) {
  test(`${path} fits a long username in its heading`, async ({ page }) => {
    await page.goto(path);
    // Changed after the page has hydrated, which would otherwise put it back
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    const h1 = page.locator("main h1");
    await h1.evaluate((el, name) => {
      el.textContent = (el.textContent ?? "").replace("margot", name);
    }, LONG_NAME);
    await expect(h1).toContainText(LONG_NAME);
    await expectNoSideScroll(page);
  });
}
