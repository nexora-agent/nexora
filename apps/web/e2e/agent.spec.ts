import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask, otherAddress } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
});

async function finishAgentWizard(page: Page) {
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

async function deploySmartWallet(page: Page) {
  await page
    .getByRole("region", { name: "Smart wallet", exact: true })
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
}

test("create agent returns an agent profile", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await expect(page).toHaveURL(/\/wallets\/1$/);
  await expect(page.getByLabel("Smart wallet profile")).toContainText("YieldGuard-01");
  await expect(page.getByLabel("Smart wallet profile")).toContainText("Treasury risk monitor");
  await expect(page.getByLabel("Smart wallet lifecycle")).toContainText("Smart wallet profile created");
  await expect(page.getByLabel("Smart wallet capabilities")).toContainText("Create transaction proposals");
});

test("view agent profile route shows saved identity", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Smart Wallet Name").fill("TreasuryGuard-02");
  await finishAgentWizard(page);
  await page.goto("/wallets/1");

  await expect(page.getByText("TreasuryGuard-02")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Smart wallet", exact: true }),
  ).toContainText("Wallet ID");
});

test("invalid name shows validation error", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByLabel("Smart Wallet Name").fill("");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Smart wallet name is required.")).toBeVisible();
});

test("another wallet opens profile in view-only mode", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(page.getByText("View only")).toBeVisible();
  await expect(page.getByText("Only the owner wallet can edit this smart wallet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Agent" })).toHaveCount(0);
});

test("agent owner creates an agent smart wallet", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  const walletCard = page.getByRole("region", {
    exact: true,
    name: "Smart wallet",
  });
  await expect(walletCard.getByText("Deployed")).toBeVisible();
  await expect(walletCard.getByText("0x0000...0001")).toBeVisible();
  await expect(walletCard.getByText("Smart wallet created.")).toBeVisible();
});

test("duplicate wallet creation shows the existing wallet", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Show Existing Wallet" }).click();

  const walletCard = page.getByRole("region", {
    exact: true,
    name: "Smart wallet",
  });
  await expect(walletCard.getByText("Existing wallet linked.")).toBeVisible();
  await expect(walletCard.getByText("0x0000...0001")).toBeVisible();
});

test("non-owner cannot create or control agent wallet", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  const walletCard = page.getByRole("region", {
    exact: true,
    name: "Smart wallet",
  });
  await expect(
    walletCard.getByText("Only the owner wallet can control this smart wallet."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create Smart Wallet" }),
  ).toHaveCount(0);
});

test("agent owner saves and reloads policy", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await page.getByLabel("Max risk score").fill("55");
  await page.getByLabel("Max transaction size").fill("35");
  await page.getByRole("button", { name: "Save Policy" }).click();

  await expect(page.getByText("Policy stored on-chain-ready profile.")).toBeVisible();
  await page.reload();

  const policyCard = page.getByLabel("Active policy");
  await expect(policyCard.getByText("55")).toBeVisible();
  await expect(policyCard.getByText("35 USDC")).toBeVisible();
});

test("invalid policy threshold is rejected", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await page.getByLabel("Max risk score").fill("200");
  await page.getByRole("button", { name: "Save Policy" }).click();

  await expect(
    page.getByText("Max risk score must be between 0 and 100."),
  ).toBeVisible();
});

test("non-owner cannot edit policy", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(
    page.getByText("Only the owner wallet can update this policy."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Policy" })).toHaveCount(0);
});

test("owner creates ERC-20 transfer intent", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Build Intent" }).click();

  const intentCard = page.getByLabel("Transaction intent");
  await expect(intentCard.getByText("ERC-20 Transfer")).toBeVisible();
  await expect(intentCard.getByText("Intent Hash")).toBeVisible();
  await expect(intentCard.getByText("Calldata")).toBeVisible();
});

test("owner creates ERC-20 approval intent", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page
    .getByLabel("Task")
    .fill("Approve 20 USDC to 0x0000000000000000000000000000000000000004");
  await page.getByRole("button", { name: "Build Intent" }).click();

  const intentCard = page.getByLabel("Transaction intent");
  await expect(intentCard.getByText("ERC-20 Approval")).toBeVisible();
  await expect(
    intentCard.getByText("Approve 20 USDC for 0x0000000000000000000000000000000000000004"),
  ).toBeVisible();
});

test("bad address blocks intent creation", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByLabel("Task").fill("Send 10 USDC to nope");
  await page.getByRole("button", { name: "Build Intent" }).click();

  await expect(page.getByText("Enter a valid target address.")).toBeVisible();
});

test("limited approval produces readable risk report", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page
    .getByLabel("Task")
    .fill("Approve 20 USDC to 0x0000000000000000000000000000000000000004");
  await page.getByRole("button", { name: "Build Intent" }).click();

  await expect(page.getByLabel("Risk score").getByText("28 / 100")).toBeVisible();
  await expect(page.getByText("Policy Result")).toBeVisible();
  await expect(page.getByLabel("Policy decision").getByText("Passed")).toBeVisible();
  await expect(page.getByText("Limited approval amount")).toBeVisible();
  await expect(page.getByLabel("AI explanation")).toBeVisible();
});

test("unlimited approval is high risk and blocked", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page
    .getByLabel("Task")
    .fill("Approve unlimited USDC to 0x0000000000000000000000000000000000000004");
  await page.getByRole("button", { name: "Build Intent" }).click();

  await expect(page.getByLabel("Risk score").getByText("85 / 100")).toBeVisible();
  await expect(
    page.getByLabel("Risk flags").getByText("Unlimited approval detected"),
  ).toBeVisible();
  await expect(page.getByLabel("Policy decision").getByText("Blocked")).toBeVisible();
});

test("unverified target increases risk", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page
    .getByLabel("Task")
    .fill("Send 10 USDC to 0x0000000000000000000000000000000000000099");
  await page.getByRole("button", { name: "Build Intent" }).click();

  await expect(
    page
      .getByLabel("Risk flags")
      .getByText("Target contract is not in the verified registry"),
  ).toBeVisible();
  await expect(page.getByLabel("Policy decision").getByText("Blocked")).toBeVisible();
});
