import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
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
    .getByRole("region", { name: "Smart wallet", exact: true })
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
}

test("agent wallet shows address, balance, funding, copy, and explorer actions", async ({
  page,
}) => {
  await createAgentWallet(page);

  const walletCard = page.getByRole("region", {
    exact: true,
    name: "Smart wallet",
  });
  await expect(walletCard.getByText("0x0000...0001")).toBeVisible();
  await expect(page.getByLabel("Smart wallet balance")).toContainText("MNT");
  await expect(page.getByLabel("Fund smart wallet panel")).toContainText(
    "Mantle Sepolia",
  );
  await expect(page.getByLabel("Fund smart wallet panel")).toContainText(
    "0x0000000000000000000000000000000000000001",
  );
  await expect(page.getByLabel("Funding amount")).toHaveValue("0.05");
  await expect(
    page.getByRole("button", { name: "Fund Smart Wallet" }),
  ).toBeVisible();

  const explorerLink = walletCard.getByRole("link", { name: "Open in Explorer" });
  await expect(explorerLink).toHaveAttribute(
    "href",
    "https://explorer.sepolia.mantle.xyz/address/0x0000000000000000000000000000000000000001",
  );

  await walletCard
    .getByLabel("Wallet actions")
    .getByRole("button", { name: "Copy Address" })
    .click();
  await expect(walletCard.getByText(/Address copied|0x000000/)).toBeVisible();

  await page.getByRole("button", { name: "Refresh Balance" }).click();
  await expect(page.getByLabel("Smart wallet balance")).toContainText("MNT");
});
