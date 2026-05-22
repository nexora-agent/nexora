import { expect, test } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test("connect wallet shows owner, Mantle network, and ready status", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  const walletControl = page.getByLabel("Connected wallet");
  await expect(walletControl.getByText(/0x742d\.\.\.f44e/i)).toBeVisible();
  await expect(walletControl.locator(".status-dot-ready")).toBeVisible();
});

test("wrong network asks the user to switch", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(page.getByLabel("Connected wallet").locator(".status-dot-wrong-network")).toBeVisible();
  await expect(page.getByRole("button", { name: "Switch" })).toBeVisible();
});

test("switching to Mantle marks the wallet ready", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Switch" }).click();

  await expect(page.getByLabel("Connected wallet").locator(".status-dot-ready")).toBeVisible();
});

test("disconnect resets the wallet state", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Disconnect" }).click();

  await expect(page.getByRole("button", { name: "Connect MetaMask" })).toBeVisible();
});
