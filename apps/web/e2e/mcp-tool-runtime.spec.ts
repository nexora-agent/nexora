import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.name = "";
  });
});

async function createFundableAgent(page: Page) {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");
  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/\d+$/);
  await page
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const modal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await modal.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(modal.getByText("Smart wallet created.")).toBeVisible();
  await modal.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Controls" }).click();
}

test("agent intent run displays an MCP-style tool trace", async ({ page }) => {
  await createFundableAgent(page);

  await page
    .getByLabel("Task")
    .fill("Approve 20 USDC to 0x0000000000000000000000000000000000000004");
  await page.getByRole("button", { name: "Build Intent" }).click();

  const trace = page.getByLabel("Tool trace");
  await expect(trace.getByText("Tool call 1")).toBeVisible();
  await expect(trace.getByText("get_agent_profile")).toBeVisible();
  await expect(trace.getByText("get_harness_config")).toBeVisible();
  await expect(trace.getByText("get_wallet_balance")).toBeVisible();
  await expect(trace.getByText("create_approval_intent")).toBeVisible();
  await expect(trace.getByText("analyze_risk")).toBeVisible();
});
