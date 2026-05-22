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

async function createAgent(page: Page) {
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
}

test("user can inspect and select a harness for an agent", async ({ page }) => {
  await createAgent(page);

  await page.getByRole("button", { name: "Edit Setup" }).click();
  const selector = page.getByLabel("Harness selector");
  await expect(
    selector.getByRole("button", { name: /Safe Approval Harness/ }),
  ).toBeVisible();
  await expect(selector.getByLabel("Harness tools")).toContainText(
    "get_wallet_balance",
  );
  await expect(selector.getByLabel("Scoring rules")).toContainText(
    "Policy compliance",
  );
  await expect(selector.getByLabel("Blocked actions")).toContainText(
    "unlimited approvals",
  );

  await selector.getByRole("button", { name: /Wallet Defense Harness/ }).click();
  await selector.getByRole("button", { name: "Save Harness" }).click();

  await expect(selector.getByText("Harness saved for this smart wallet.")).toBeVisible();
  await page.goto("/dashboard");
  await expect(
    page.getByLabel("Smart wallets table").getByText("Wallet Defense Harness"),
  ).toBeVisible();
});

test("harness selection is separate from objective state", async ({ page }) => {
  await createAgent(page);

  await page.getByRole("button", { name: "Edit Setup" }).click();
  const selector = page.getByLabel("Harness selector");
  await selector.getByRole("button", { name: /Byreal Safe DeFi Harness/ }).click();
  await expect(selector.getByLabel("Harness tools")).toContainText(
    "get_byreal_pools",
  );
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByLabel("Next step")).toContainText("Create Smart Wallet");
});
