// ABOUTME: Checks the diary icon in the nav draws a clean book, with no stray curl at the bottom left.
// ABOUTME: Signs in as demo, since the nav's Activity link is where the icon shows.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.use({ storageState: DEMO_SESSION });

test("the diary icon's cover stays inside its spine", async ({ page }) => {
  await page.goto("/");

  const cover = page
    .getByRole("link", { name: "Activity", exact: true })
    .locator("svg path")
    .first();
  // The cover runs from the spine at x=4 to the edge at x=20, top to bottom,
  // with both left corners rounded the same way
  const box = await cover.evaluate((path) => {
    const { x, y, width, height } = (path as SVGPathElement).getBBox();
    return { x, y, width, height };
  });
  expect(box.x).toBeCloseTo(4, 2);
  expect(box.y).toBeCloseTo(2, 2);
  expect(box.width).toBeCloseTo(16, 2);
  expect(box.height).toBeCloseTo(20, 2);
});
