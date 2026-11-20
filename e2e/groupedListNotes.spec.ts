// ABOUTME: Writing an item's note in a grouped list that hasn't been saved yet, as the demo account.
// ABOUTME: Nothing is saved, so the shared local database is left as it was.
import { expect, test } from "@playwright/test";
import { DEMO_SESSION } from "./signIn";

test.use({ storageState: DEMO_SESSION });

test("saving a note keeps the rest of an unsaved grouped list", async ({
  page,
}) => {
  await page.goto("/list/new?add=Q131538");
  await page.getByText("Grouped list", { exact: true }).click();
  await page.getByLabel("Title").fill("Hot spring animals");

  await page
    .getByRole("button", { name: "Add a note for Capybara", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Note for Capybara" })
    .fill("Brings its own orange");
  await page.getByRole("button", { name: "Save note" }).click();

  await expect(
    page.getByRole("button", {
      name: "Edit the note for Capybara",
      exact: true,
    }),
  ).toHaveText("Brings its own orange");
  await expect(page.getByLabel("Title")).toHaveValue("Hot spring animals");
});
