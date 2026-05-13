import { expect, test } from "@playwright/test";
import { mockMetaMask, otherAddress } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

test("create agent returns an agent profile", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-agent");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Create Agent" }).click();

  await expect(page).toHaveURL(/\/agents\/1$/);
  await expect(page.getByText("Agent ID: 1")).toBeVisible();
  await expect(page.getByText("YieldGuard-01")).toBeVisible();
  await expect(page.getByText("Safe DeFi activity on Mantle")).toBeVisible();
  await expect(page.getByText("ipfs://nexora-local/agent-1")).toBeVisible();
});

test("view agent profile route shows saved identity", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-agent");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Agent Name").fill("TreasuryGuard-02");
  await page.getByRole("button", { name: "Create Agent" }).click();
  await page.goto("/agents/1");

  await expect(page.getByText("TreasuryGuard-02")).toBeVisible();
  await expect(page.getByText("Agent ID: 1")).toBeVisible();
});

test("invalid name shows validation error", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-agent");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Agent Name").fill("");
  await page.getByRole("button", { name: "Create Agent" }).click();

  await expect(page.getByText("Agent name is required.")).toBeVisible();
});

test("another wallet opens profile in view-only mode", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-agent");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Create Agent" }).click();

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/agents/1");
  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(page.getByText("View only")).toBeVisible();
  await expect(page.getByText("Only the owner wallet can edit this agent.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Agent" })).toHaveCount(0);
});
