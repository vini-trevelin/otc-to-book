import { expect, test } from "@playwright/test";

test("user message updates chat, event feed, and book", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Broker Chat")).toBeVisible();
  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("vendo petro27 7.30 5mm");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("vendo petro27 7.30 5mm").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Expand parsed events" })).toBeVisible();
  await page.getByRole("button", { name: "Expand parsed events" }).click();
  await expect(page.getByText("quote_event").first()).toBeVisible();
  await expect(page.getByText("PETRO27").first()).toBeVisible();
  await expect(page.getByText("7.30").first()).toBeVisible();
});

test("side panels expose the book-first shell controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Broker Chat")).toBeVisible();
  await expect(page.getByText("Parsed Events")).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand parsed events" })).toBeVisible();

  await page.getByRole("button", { name: "Collapse broker chat" }).click();
  await expect(page.getByText("Broker Chat")).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand broker chat" })).toBeVisible();

  await page.getByRole("button", { name: "Expand broker chat" }).click();
  await expect(page.getByText("Broker Chat")).toBeVisible();
});

test("replacement quote mutes superseded row", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("bid petro27 7.25");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("7.25").first()).toBeVisible();

  await page.getByLabel("Message").fill("bid petro27 7.27");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByTestId("book-row-active").filter({ hasText: "7.27" }).first()).toBeVisible();
  await expect(
    page.getByTestId("book-row-superseded").filter({ hasText: "7.25" }).first()
  ).toBeVisible();
});

test("auto simulator starts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await page.getByRole("button", { name: "Expand parsed events" }).click();
  await page.getByRole("button", { name: "Start" }).click();

  await expect(page.getByText(/message_received|quote_/).first()).toBeVisible({ timeout: 5000 });
});
