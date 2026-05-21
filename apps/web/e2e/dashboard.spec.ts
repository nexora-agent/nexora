import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

async function finishAgentWizard(page: Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/\d+$/);
}

test("empty dashboard invites the user to create an agent", async ({ page }) => {
  await page.goto("/dashboard");

  const emptyDashboard = page.getByLabel("Empty dashboard");
  await expect(
    page.getByRole("heading", { name: "Smart Wallets", exact: true }),
  ).toBeVisible();
  await expect(
    emptyDashboard.getByText("Create your first smart wallet"),
  ).toBeVisible();
  await expect(
    emptyDashboard.getByRole("link", { name: "Create Smart Wallet" }),
  ).toBeVisible();
});

test("created agents appear in the dashboard and open detail pages", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await finishAgentWizard(page);
  await page.goto("/dashboard");

  const table = page.getByLabel("Smart wallets table");
  await expect(table.getByText("YieldGuard")).toBeVisible();
  await expect(table.getByText("Safe Approval Harness")).toBeVisible();
  await expect(table.getByText("Not created")).toBeVisible();
  await expect(table.getByText("Needs wallet")).toBeVisible();
  await expect(table.getByText("Benchmark Score")).toBeVisible();

  await table.getByRole("link", { name: "Open" }).click();
  await expect(page).toHaveURL(/\/wallets\/1$/);
});

test("dashboard shows needs funding after wallet creation", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await finishAgentWizard(page);
  await page
    .getByRole("region", { name: "Smart wallet", exact: true })
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  await page.goto("/dashboard");

  const table = page.getByLabel("Smart wallets table");
  await expect(table.getByText("0x0000...0001")).toBeVisible();
  await expect(table.getByText("Needs funding")).toBeVisible();
});
