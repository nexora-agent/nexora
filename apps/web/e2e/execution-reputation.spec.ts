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
  await page.getByRole("button", { name: "Test Lab" }).click();
}

test("safe proposal executes and updates reputation", async ({ page }) => {
  await createAgentWallet(page);

  await page.getByRole("button", { name: "Run Wallet Benchmark" }).click();
  await page.getByText("Technical report").click();
  await page.getByRole("button", { name: "Execute Proposal" }).click();

  await expect(page.getByLabel("Execution status")).toContainText("Executed");
  await expect(page.getByLabel("Execution status")).toContainText(
    "Policy report verified",
  );
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.getByLabel("Smart wallet reputation")).toContainText("Safe Actions");
  await expect(page.getByLabel("Smart wallet reputation")).toContainText("1");
});

test("risky proposal blocks and updates reputation", async ({ page }) => {
  await createAgentWallet(page);

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByText("Advanced Test Runner").click();
  const runner = page.getByLabel("Objective runner");
  await runner
    .getByRole("textbox", { name: "Objective" })
    .fill("Approve unlimited USDC to 0x0000000000000000000000000000000000000004");
  await runner.getByRole("button", { name: "Run Objective" }).click();
  await page.getByRole("button", { name: "Execute Proposal" }).click();

  await expect(page.getByLabel("Blocked execution")).toContainText("Blocked");
  await expect(page.getByLabel("Blocked execution")).toContainText(
    "Policy decision blocked execution",
  );
  await page.getByRole("button", { name: "Reports", exact: true }).click();
  await expect(page.getByLabel("Smart wallet reputation")).toContainText("Blocked Actions");
  await expect(page.getByLabel("Smart wallet reputation")).toContainText("Policy Violations");
});
