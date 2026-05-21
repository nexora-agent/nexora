import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

async function createAgentWallet(page: Page) {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/\d+$/);
  await page
    .getByRole("region", { name: "Smart wallet", exact: true })
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
}

test("user submits an objective inside the selected harness", async ({ page }) => {
  await createAgentWallet(page);

  const runner = page.getByLabel("Objective runner");
  await expect(runner.getByText("Safe Approval Harness")).toBeVisible();
  await runner
    .getByRole("textbox", { name: "Objective" })
    .fill("Prepare the safest 20 USDC approval possible.");
  await runner.getByRole("button", { name: "Run Objective" }).click();

  const result = page.getByLabel("Objective result");
  await expect(result.getByText("Prepare the safest 20 USDC approval possible.")).toBeVisible();
  await expect(result.getByText("safe-approval").first()).toBeVisible();
  await expect(result.getByLabel("Tool trace")).toContainText("get_harness_config");
  await expect(result.getByLabel("Tool trace")).toContainText("create_approval_intent");
  await expect(result.getByLabel("Smart wallet proposal")).toContainText("erc20_approval");
  await expect(result.getByLabel("Proposal risk")).toContainText("Verified");
  await expect(result.getByLabel("Benchmark score")).toContainText("Benchmark Score");
  await expect(result.getByLabel("Benchmark score")).toContainText("Policy");
  await expect(result.getByLabel("On-chain report")).toContainText("Wallet ID");
  await expect(result.getByLabel("On-chain report")).toContainText("safe-approval");
  await expect(result.getByLabel("On-chain report")).toContainText("Benchmark Score");
  await expect(result.getByLabel("Transaction intent")).toContainText("ERC-20 Approval");
  await expect(result.getByLabel("Risk score")).toContainText("28 / 100");
  await expect(page.getByLabel("Objective history")).toContainText(
    "Prepare the safest 20 USDC approval possible.",
  );

  await page.goto("/dashboard");
  await expect(page.getByLabel("Smart wallets table")).toContainText("YieldGuard-01");
  await expect(page.getByLabel("Smart wallets table")).toContainText("90");
});

test("objective runner requires a wallet before running", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();

  const runner = page.getByLabel("Objective runner");
  await runner.getByRole("button", { name: "Run Objective" }).click();

  await expect(
    runner.getByText("Create and fund the smart wallet before running objectives."),
  ).toBeVisible();
});
