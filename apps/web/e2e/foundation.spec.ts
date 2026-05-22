import { expect, test } from "@playwright/test";

test("landing page opens the dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Nexora Smart Wallets" })).toBeVisible();
  await expect(
    page.getByText("Create AI-controlled smart wallets"),
  ).toBeVisible();
  await expect(
    page.getByLabel("Primary navigation").getByRole("link", { name: "Create Smart Wallet" }),
  ).toBeVisible();
});

test("wallet button is visible on the homepage", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: "Connect MetaMask" })).toHaveCount(
    1,
  );
});

test("primary navigation stays product-focused", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Arena" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Docs" })).toHaveCount(0);
});
