import { expect, test } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("user creates an agent through the identity wizard", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await expect(page.getByLabel("Smart wallet creation steps")).toBeVisible();
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await page.getByLabel("Description").fill("Policy-first Mantle wallet agent");

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByLabel("Primary Purpose")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: /Safe Approval Harness/ })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Demo Runner")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Create smart wallet later")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();

  const review = page.getByLabel("Smart wallet review");
  await expect(review.getByText("YieldGuard")).toBeVisible();
  await expect(review.getByText("Safe Approval Harness")).toBeVisible();
  await expect(review.getByText("Demo")).toBeVisible();
  await expect(review.getByText("Create later")).toBeVisible();

  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/1$/);
  await expect(page.getByLabel("Smart wallet profile").getByText("YieldGuard")).toBeVisible();
  await expect(page.getByLabel("Smart wallet lifecycle")).toContainText("Smart wallet profile created");
  await expect(page.getByLabel("Smart wallet capabilities")).toContainText("Read wallet balance");
});

test("empty name is rejected before runtime selection", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Smart Wallet Name").fill("");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Smart wallet name is required.")).toBeVisible();
  await expect(page.getByLabel("Primary Purpose")).toHaveCount(0);
});

test("smart wallet setup can create the agent wallet during creation", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByText("Create smart wallet now").click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();

  const walletCard = page.getByRole("region", {
    exact: true,
    name: "Smart wallet",
  });
  await expect(walletCard.getByText("Deployed")).toBeVisible();
  await expect(walletCard.getByText("0x0000...0001")).toBeVisible();
  await expect(page.getByLabel("Smart wallet lifecycle")).toContainText("Smart wallet deployed");
});
