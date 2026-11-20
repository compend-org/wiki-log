// ABOUTME: Opens each page anyone can see, signed out, and checks it loads instead of the error screen.
// ABOUTME: Uses the seed's fixed names: margot's profile and Saturn (Q193), whose ids don't change.
import { expect, test } from "@playwright/test";

const PAGES = [
  { path: "/", heading: "Rate, review anything." },
  { path: "/item/Q193", heading: "Saturn" },
  { path: "/item/Q193/ratings/5", heading: "★★★★★ reviews of Saturn" },
  { path: "/u/margot", heading: "margot" },
  { path: "/u/margot/reviews", heading: "Reviews by margot" },
  { path: "/u/margot/lists", heading: "Lists by margot" },
  { path: "/u/margot/connections", heading: "Followers and following" },
  { path: "/u/margot/pinned", heading: "Pinned by margot" },
  { path: "/u/margot/ratings/5", heading: "★★★★★ reviews by margot" },
  { path: "/u/margot/activity?tab=likes", heading: "margot's activity" },
  { path: "/guide", heading: "“Style Guide”" },
  { path: "/privacy", heading: "Privacy" },
  { path: "/contact", heading: "Contact" },
  { path: "/support", heading: "Donate" },
  { path: "/login", heading: "Sign in" },
  { path: "/forgot-password", heading: "Reset your password" },
];

for (const { path, heading } of PAGES) {
  test(`${path} loads`, async ({ page }) => {
    await page.goto(path);

    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Something went wrong.")).toHaveCount(0);
  });
}
