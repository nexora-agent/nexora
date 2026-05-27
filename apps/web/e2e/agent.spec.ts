import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask, otherAddress } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.name = "";
  });
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
  const testLab = page.getByRole("button", { name: "Test Lab" });
  if (await testLab.isVisible()) {
    return;
  }

  await page
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const modal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await modal.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(modal.getByText("Smart wallet created.")).toBeVisible();
  await modal.getByRole("button", { name: "Close" }).click();
}

async function connectIfNeeded(page: Page) {
  const connectButton = page.getByRole("button", { name: "Connect MetaMask" }).first();
  if (await connectButton.isVisible()) {
    await connectButton.click();
  }
}

test("create agent returns an agent profile", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);

  await expect(page).toHaveURL(/\/wallets\/1$/);
  await expect(page.getByLabel("Smart wallet profile")).toContainText("YieldGuard-01");
  await expect(page.getByLabel("Smart wallet profile")).toContainText("Treasury risk monitor");
  await expect(page.getByLabel("Next step")).toContainText("Fund Wallet");
  await expect(page.getByRole("button", { name: "Mission" })).toBeVisible();
});

test("view agent profile route shows saved identity", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("TreasuryGuard-02");
  await finishAgentWizard(page);
  await page.goto("/wallets/1");

  await expect(page.getByRole("heading", { name: "TreasuryGuard-02" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Setup" })).toBeVisible();
  await expect(page.getByLabel("Next step")).toContainText("Fund Wallet");
});

test("invalid name shows validation error", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("");
  await page.getByRole("button", { name: "Next", exact: true }).click();

  await expect(page.getByText("Smart wallet name is required.")).toBeVisible();
});

test("another wallet opens profile in view-only mode", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await connectIfNeeded(page);

  await expect(page.getByText("View only")).toBeVisible();
  await expect(page.getByText("Only the owner wallet can edit this smart wallet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Agent" })).toHaveCount(0);
});

test("agent owner creates an agent smart wallet", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await expect(page.getByLabel("Smart wallet profile")).toContainText("0x0000...0001");
  await expect(page.getByRole("button", { name: "Fund Wallet" })).toBeVisible();
});

test("wallet next step changes after wallet creation", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await expect(page.getByLabel("Smart wallet profile").getByRole("button", { name: "Fund Wallet" })).toBeVisible();
});

test("mission model tools reports timeline and controls tabs work", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await page.getByRole("button", { name: "Mission" }).click();
  await expect(page.getByLabel("Mission tab")).toContainText("Mission Type");
  await expect(page.getByLabel("Mission tab")).toContainText("Live Eligibility");

  await page.getByRole("button", { name: "Model" }).click();
  await expect(page.getByLabel("Model tab")).toContainText("Nexora Demo Model");
  await page.getByRole("button", { name: "Edit Model" }).click();
  await expect(page.getByRole("dialog", { name: "EditModelModal" })).toBeVisible();
  await page.route("http://model.local/v1/chat/completions", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        choices: [{ message: { content: '{"status":"ok"}' } }],
        status: "ok",
      }),
    });
  });
  await page.getByLabel("Connection Type").selectOption("openai-compatible");
  await page.getByLabel("Edit model name").fill("Local Policy Model");
  await page.getByLabel("Edit endpoint URL").fill("http://model.local/v1");
  await page.getByLabel("Session API key").fill("temporary-session-key");
  await page.getByRole("button", { name: "Test Model" }).click();
  await expect(page.getByLabel("Model connection test")).toContainText("Connected");
  await expect(page.getByLabel("Model connection test")).toContainText('"status": "ok"');
  await page.getByRole("button", { name: "Save Model" }).click();
  await expect(page.getByLabel("Model tab")).toContainText("Local Policy Model");
  await expect(page.getByLabel("Model tab")).toContainText("Openai Compatible");

  await page.getByRole("button", { name: "Tools", exact: true }).click();
  await expect(page.getByLabel("Tools tab")).toContainText("Wallet Tools");
  await expect(page.getByLabel("Tools tab")).toContainText("RealClaw / Byreal Tools");
  await page.getByRole("button", { name: "Edit Tools" }).click();
  await expect(page.getByRole("dialog", { name: "EditToolsModal" })).toBeVisible();
  await page.getByRole("button", { name: "Save Tools" }).click();

  await page.getByRole("button", { name: "Reports" }).click();
  await expect(page.getByLabel("Reports tab")).toContainText("No reports yet");
  await page.getByRole("button", { name: "Timeline" }).click();
  await expect(page.getByLabel("Timeline tab")).toContainText("No Test Lab runs yet");
  await page.getByRole("button", { name: "Controls" }).click();
  await expect(page.getByLabel("Controls tab")).toContainText("Policy");
  await expect(page.getByLabel("Controls tab")).toContainText("Tool Settings");
});

test("non-owner cannot create or control agent wallet", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await connectIfNeeded(page);

  await page.getByLabel("Next step").getByRole("button", { name: "Create Smart Wallet" }).click();
  const walletCard = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await expect(
    walletCard.getByText("Only the owner wallet can control this smart wallet."),
  ).toBeVisible();
});

test("agent owner saves and reloads policy", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Policy Settings" }).click();
  await page.getByLabel("Max risk score").fill("55");
  await page.getByLabel("Max transaction size").fill("35");
  await page.getByRole("button", { name: "Save Policy" }).click();

  await expect(page.getByText("Policy stored on-chain-ready profile.")).toBeVisible();
  await page.reload();

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Policy Settings" }).click();
  const policyCard = page.getByLabel("Active policy");
  await expect(policyCard.getByText("55")).toBeVisible();
  await expect(policyCard.getByText("35 USDC")).toBeVisible();
});

test("invalid policy threshold is rejected", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Policy Settings" }).click();
  await page.getByLabel("Max risk score").fill("200");
  await page.getByRole("button", { name: "Save Policy" }).click();

  await expect(
    page.getByText("Max risk score must be between 0 and 100."),
  ).toBeVisible();
});

test("non-owner cannot edit policy", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);

  await mockMetaMask(page, "0x138b", otherAddress);
  await page.goto("/wallets/1");
  await connectIfNeeded(page);

  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Policy Settings" }).click();
  await expect(
    page.getByText("Only the owner wallet can update this policy."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Policy" })).toHaveCount(0);
});

test("owner creates ERC-20 transfer intent", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByRole("button", { name: "Build Intent" }).click();

  const intentCard = page.getByLabel("Transaction intent");
  await expect(intentCard.getByText("ERC-20 Transfer")).toBeVisible();
  await expect(intentCard.getByText("Intent Hash")).toBeVisible();
  await expect(intentCard.getByText("Calldata")).toBeVisible();
});

test("owner creates ERC-20 approval intent", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
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

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
  await page.getByLabel("Task").fill("Send 10 USDC to nope");
  await page.getByRole("button", { name: "Build Intent" }).click();

  await expect(page.getByText("Enter a valid target address.")).toBeVisible();
});

test("limited approval produces readable risk report", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
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

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
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

  await connectIfNeeded(page);
  await finishAgentWizard(page);
  await deploySmartWallet(page);
  await page.getByRole("button", { name: "Controls" }).click();
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
