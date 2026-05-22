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
}

test("agent uses Byreal Safe DeFi Harness tools for a bounded proposal", async ({
  page,
}) => {
  await createAgentWallet(page);

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Change Harness" }).click();
  const selector = page.getByLabel("Harness selector");
  await selector
    .getByRole("button", { name: /Byreal Safe DeFi Harness/ })
    .click();
  await expect(selector.getByLabel("Harness tools")).toContainText(
    "get_byreal_pools",
  );
  await selector.getByRole("button", { name: "Save Harness" }).click();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Test Lab" }).click();
  const runner = page.getByLabel("Objective runner");
  await expect(runner.getByText("Byreal Safe DeFi Harness")).toBeVisible();
  await runner
    .getByRole("textbox", { name: "Objective" })
    .fill("Inspect Byreal pools and propose one safe bounded swap.");
  await runner.getByRole("button", { name: "Run Objective" }).click();

  const result = page.getByLabel("Objective result");
  await expect(result.getByLabel("Byreal pool")).toContainText("Byreal");
  await expect(result.getByLabel("Tool trace")).toContainText("get_byreal_pools");
  await expect(result.getByLabel("Tool trace")).toContainText(
    "inspect_byreal_pool",
  );
  await expect(result.getByLabel("Tool trace")).toContainText(
    "create_byreal_swap_intent",
  );
  await expect(result.getByLabel("Tool trace")).toContainText(
    "analyze_byreal_action_risk",
  );
  await expect(result.getByLabel("Byreal action proposal")).toContainText(
    "Intent Hash",
  );
  await expect(result.getByLabel("Proposal risk")).toContainText("Verified");
});
