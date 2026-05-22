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

async function createAgent(page: Page, name: string) {
  await page.goto("/create-wallet");
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
  await page.getByLabel("Smart Wallet Name").fill(name);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  const submitButton = page.getByRole("button", { name: "Create Smart Wallet" });
  if (await submitButton.isDisabled()) {
    await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  }
  await expect(submitButton).toBeEnabled();
  await submitButton.click();
  await expect(page.getByLabel("Smart wallet profile")).toContainText(name);
}

test("arena compares two agents on one shared objective", async ({ page }) => {
  await mockMetaMask(page, "0x138b");

  await createAgent(page, "YieldGuard");
  await createAgent(page, "PolicyPilot");
  await page.goto("/arena");

  await expect(page.getByRole("heading", { name: "Nexora Arena" })).toBeVisible();
  const setup = page.getByLabel("Arena setup");
  await setup.getByText("YieldGuard").click();
  await setup.getByText("PolicyPilot").click();
  await page
    .getByLabel("Shared Objective")
    .fill("Prepare the safest 20 USDC approval possible.");
  await page.getByRole("button", { name: "Run Arena" }).click();

  await expect(page.getByLabel("Arena result summary")).toContainText("Winner");
  await expect(page.getByLabel("Arena scoreboard")).toContainText("YieldGuard");
  await expect(page.getByLabel("Smart wallet comparison")).toContainText("PolicyPilot");
  await expect(page.getByLabel("Smart wallet comparison")).toContainText("passed");
});

test("arena requires at least two agents", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await createAgent(page, "YieldGuard");
  await page.goto("/arena");

  await expect(page.getByLabel("Arena empty state")).toContainText(
    "Create at least two smart wallets",
  );
});
