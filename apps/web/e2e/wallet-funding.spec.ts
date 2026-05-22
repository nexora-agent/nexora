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

async function connectIfNeeded(page: Page) {
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
}

async function createAgentWallet(page: Page) {
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
  await expect(page).toHaveURL(/\/wallets\/\d+$/);
  await page
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const createModal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await createModal
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  await expect(createModal.getByText("Smart wallet created.")).toBeVisible();
  await createModal.getByRole("button", { name: "Close" }).click();
  await page.getByLabel("Smart wallet profile").getByRole("button", { name: "Fund Wallet" }).click();
}

test("agent wallet shows address, balance, funding, copy, and explorer actions", async ({
  page,
}) => {
  await createAgentWallet(page);

  const fundModal = page.getByRole("dialog", { name: "FundWalletModal" });
  const walletCard = fundModal;
  await expect(walletCard.getByText("0x0000000000000000000000000000000000000001")).toBeVisible();
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
    .getByRole("button", { name: "Copy Address" })
    .click();
  await expect(walletCard.getByText(/Address copied|0x000000/)).toBeVisible();

  await page.getByRole("button", { name: "Refresh Balance" }).click();
  await expect(page.getByLabel("Smart wallet balance")).toContainText("MNT");
});
