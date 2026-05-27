import { expect, test } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.name = "";
  });
});

async function connectIfNeeded(page: import("@playwright/test").Page) {
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
}

test("user creates an agent through the identity wizard", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await expect(page.getByLabel("Smart wallet creation steps")).toBeVisible();
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await page.getByLabel("Description").fill("Policy-first Mantle wallet agent");
  await expect(page.getByLabel("Primary Purpose")).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Demo Runner")).toBeVisible();
  await expect(page.getByLabel("Model name")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: /Safe Approval Harness/ })).toBeVisible();
  await expect(page.getByLabel("Selected tools")).toContainText("Wallet Tools");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Policy review")).toContainText("Policy checks required");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Deploy wallet review")).toContainText("Smart wallet will be deployed now");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  const review = page.getByLabel("Smart wallet review");
  await expect(review.getByText("YieldGuard")).toBeVisible();
  await expect(review.getByText("Safe Approval Harness")).toBeVisible();
  await expect(review.getByText("Demo", { exact: true })).toBeVisible();
  await expect(review.getByText("Nexora Demo Model")).toBeVisible();
  await expect(review.getByText("enabled")).toBeVisible();
  await expect(review.getByText("Deploy during creation")).toBeVisible();

  await connectIfNeeded(page);
  await expect(page.getByRole("button", { name: "Create Smart Wallet" })).toBeEnabled();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/1$/);
  await expect(page.getByLabel("Smart wallet profile").getByText("YieldGuard")).toBeVisible();
  await expect(page.getByRole("button", { name: "Fund Wallet" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test Lab" })).toBeVisible();
});

test("empty name is rejected before runtime selection", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Smart wallet name is required.")).toBeVisible();
  await expect(page.getByLabel("Model name")).toHaveCount(0);
});

test("smart wallet setup can create the agent wallet during creation", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await connectIfNeeded(page);
  await expect(page.getByRole("button", { name: "Create Smart Wallet" })).toBeEnabled();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();

  await expect(page.getByLabel("Smart wallet profile")).toContainText("0x0000...0001");
  await expect(page.getByLabel("Smart wallet profile")).toContainText("0x0000...0001");
});
