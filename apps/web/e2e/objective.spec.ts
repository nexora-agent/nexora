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
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const createModal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await createModal
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  await expect(createModal.getByText("Smart wallet created.")).toBeVisible();
  await createModal.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Test Lab" }).click();
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

test("objective runner is hidden until the smart wallet exists", async ({ page }) => {
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

  await expect(page.getByLabel("Next step")).toContainText("Create Smart Wallet");
  await expect(page.getByRole("button", { name: "Test Lab" })).toHaveCount(0);
  await expect(page.getByLabel("Objective runner")).toHaveCount(0);
});
