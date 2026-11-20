// ABOUTME: Pages for your own account: they ask you to sign in when you aren't, and open when you are.
// ABOUTME: The signed-in half starts from the demo account's saved session.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.describe("signed out", () => {
  test("making a list sends you to sign in first", async ({ page }) => {
    await page.goto("/list/new");
    await expect(page).toHaveURL("/login?next=%2Flist%2Fnew");
    await expect(
      page.getByRole("heading", { name: "Sign in", exact: true }),
    ).toBeVisible();
  });

  test("your activity asks you to sign in", async ({ page }) => {
    await page.goto("/activity");
    await expect(page.getByText("Sign in to see your activity")).toBeVisible();
  });
});

test.describe("signed in", () => {
  test.use({ storageState: DEMO_SESSION });

  const PAGES = [
    { path: "/activity", heading: "Your activity" },
    { path: "/notifications", heading: "Notifications" },
    { path: "/settings", heading: "Profile settings" },
    { path: "/list/new", heading: "New list" },
  ];

  for (const { path, heading } of PAGES) {
    test(`${path} opens`, async ({ page }) => {
      await page.goto(path);
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
    });
  }
});
