import { expect, test } from "@playwright/test";

test("user message updates chat, event feed, and book", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Broker Chat")).toBeVisible();
  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("vendo petro27 7.30 5mm");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("vendo petro27 7.30 5mm").first()).toBeVisible();
  await expect(page.getByText("quote_event").first()).toBeVisible();
  await expect(page.getByText("PETRO27").first()).toBeVisible();
  await expect(page.getByText("7.30").first()).toBeVisible();
});

test("replacement quote mutes superseded row", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("bid petro27 7.25");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("7.25").first()).toBeVisible();

  await page.getByLabel("Message").fill("bid petro27 7.27");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("book-row-active").first()).toContainText("7.27");
  await expect(page.getByTestId("book-row-superseded").first()).toContainText("7.25");
});

test("auto simulator starts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText(/message_received|quote_/).first()).toBeVisible({ timeout: 5000 });
});
