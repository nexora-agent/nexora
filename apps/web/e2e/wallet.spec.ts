import { expect, test } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test("connect wallet shows owner, Mantle network, and ready status", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText(/0x742d\.\.\.f44e/i)).toBeVisible();
  await expect(walletCard.getByText("Mantle Sepolia")).toBeVisible();
  await expect(walletCard.locator(".status-ready")).toHaveText("Ready");
});

test("wrong network asks the user to switch", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(page.getByText("Wrong network detected")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Mantle" }),
  ).toBeVisible();
});

test("switching to Mantle marks the wallet ready", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Switch to Mantle" }).click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText("Mantle Sepolia")).toBeVisible();
  await expect(walletCard.locator(".status-ready")).toHaveText("Ready");
});

test("disconnect resets the wallet state", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Disconnect" }).click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText("Not connected").first()).toBeVisible();
  await expect(walletCard.locator(".status-disconnected")).toHaveText(
    "Disconnected",
  );
});
