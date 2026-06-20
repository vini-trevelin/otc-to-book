import { expect, type Page, test } from "@playwright/test";

async function expandParsedEvents(page: Page) {
  const viewport = page.viewportSize() ?? { width: 1280, height: 720 };
  await page.mouse.move(viewport.width - 2, 36);
  await page.getByRole("button", { name: "Expand parsed events" }).click();
}

test("user message updates chat, event feed, and book", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Broker Chat" })).toBeVisible();
  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("vendo petro27 7.30 5mm");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("vendo petro27 7.30 5mm").first()).toBeVisible();
  await expandParsedEvents(page);
  await expect(page.getByText("quote_event").first()).toBeVisible();
  await expect(page.getByText("PETRO27").first()).toBeVisible();
  await expect(page.getByText("7.30").first()).toBeVisible();
});

test("side panels expose the book-first shell controls", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Broker Chat" })).toBeVisible();
  await expect(page.getByText("Parsed Events")).toBeHidden();
  await expect(page.getByRole("heading", { name: "Connect" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Simulate" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Insert" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chat", exact: true })).toBeVisible();
  await page.getByRole("heading", { name: "Simulate" }).hover();
  await expect(page.getByText("Generate broker flow with controlled noise.")).toBeVisible();

  await page.getByRole("button", { name: "Collapse broker chat" }).click();
  await expect(page.getByRole("heading", { name: "Broker Chat" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Expand broker chat" })).toBeVisible();

  await page.getByRole("button", { name: "Expand broker chat" }).click();
  await expect(page.getByRole("heading", { name: "Broker Chat" })).toBeVisible();
});

test("replacement quote mutes superseded row", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await page.getByLabel("Message").fill("bid petro27 7.25");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("7.25").first()).toBeVisible();

  await page.getByLabel("Message").fill("bid petro27 7.27");
  await page.getByRole("button", { name: "Send" }).click();

  const activeReplacement = page.getByTestId("book-row-active").filter({ hasText: "7.27" }).first();
  await expect(activeReplacement).toBeVisible();
  await expect(activeReplacement).toContainText("BROKER_A");
  await expect(activeReplacement).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(
    page.getByTestId("book-row-superseded").filter({ hasText: "7.25" }).first()
  ).toBeVisible();
});

test("auto simulator starts", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("connected")).toBeVisible();
  await expandParsedEvents(page);
  await page.getByRole("button", { name: "Start simulation" }).click();

  await expect(page.getByText(/message_received|quote_/).first()).toBeVisible({ timeout: 5000 });
});
