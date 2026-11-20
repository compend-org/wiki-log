// ABOUTME: Liking a review and taking the like back, as the demo account.
// ABOUTME: The test undoes its own like, so the shared local database ends as it started.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.use({ storageState: DEMO_SESSION });

test("liking a review and unliking it", async ({ page }) => {
  await page.goto("/u/margot/reviews");
  await page
    .getByRole("link", { name: "Open margot's review of Capybara" })
    .click();
  await expect(
    page
      .getByRole("article")
      .getByText("Sits in a hot spring with an orange on its head"),
  ).toBeVisible();

  // The review's own like button comes first, before its comments'
  const like = page
    .getByRole("button", { name: /^(Like|Unlike) this review$/ })
    .first();
  const wasLiked =
    (await like.getAttribute("aria-label")) === "Unlike this review";
  const count = Number(await like.textContent());

  await like.click();
  await expect(like).toHaveAccessibleName(
    wasLiked ? "Like this review" : "Unlike this review",
  );
  await expect(like).toHaveText(String(wasLiked ? count - 1 : count + 1));

  await like.click();
  await expect(like).toHaveAccessibleName(
    wasLiked ? "Unlike this review" : "Like this review",
  );
  await expect(like).toHaveText(String(count));
});
