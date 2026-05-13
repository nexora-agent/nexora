import { expect, test } from "@playwright/test";

test("landing page loads with Nexora value proposition", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Nexora" })).toBeVisible();
  await expect(
    page.getByText("Verifiable safety layer for on-chain AI agents."),
  ).toBeVisible();
  await expect(page.getByText("Create an AI agent, give it")).toBeVisible();
});

test("wallet button is visible on the homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Connect MetaMask" })).toHaveCount(
    2,
  );
});

test("demo route shows the full planned user journey", async ({ page }) => {
  await page.goto("/demo");

  await expect(page.getByRole("heading", { name: "Demo Flow" })).toBeVisible();
  await expect(page.getByText("Create agent", { exact: true })).toBeVisible();
  await expect(page.getByText("Update reputation")).toBeVisible();
});

test("docs route shows setup instructions are present", async ({ page }) => {
  await page.goto("/docs");

  await expect(
    page.getByRole("heading", { name: "Setup instructions are present" }),
  ).toBeVisible();
  await expect(page.getByText("/README.md")).toBeVisible();
});
