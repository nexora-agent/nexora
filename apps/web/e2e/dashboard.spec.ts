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

async function finishAgentWizard(page: Page) {
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await connectIfNeeded(page);
  await expect(page.getByRole("button", { name: "Create Smart Wallet" })).toBeEnabled();
  await page.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page).toHaveURL(/\/wallets\/\d+$/);
}

test("empty dashboard invites the user to create an agent", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page.getByLabel("Dashboard overview")).toContainText("Nexora Smart Wallets");
  await expect(page.getByLabel("Dashboard overview")).toContainText(
    "Create AI-controlled smart wallets",
  );
  await expect(page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Smart Wallet" })).toBeVisible();
  await expect(page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Harness" })).toBeVisible();
  await expect(page.getByTestId("dashboard-container")).toBeVisible();
  await expect(page.getByLabel("Dashboard summary")).toContainText("Total Smart Wallets");
  await expect(page.getByLabel("Dashboard summary")).toContainText("Needs Funding");
  await expect(page.getByLabel("Dashboard summary")).toContainText("Average Benchmark");
  await expect(page.getByLabel("Dashboard summary")).toContainText("Active Wallets");
  await expect(page.getByLabel("Dashboard summary").locator("article")).toHaveCount(4);

  const emptyDashboard = page.getByLabel("Empty dashboard");
  await expect(
    page.getByRole("heading", { name: "Nexora Smart Wallets", exact: true }),
  ).toBeVisible();
  await expect(
    emptyDashboard.getByText("Create your first AI-controlled smart wallet."),
  ).toBeVisible();
  await expect(
    emptyDashboard.getByRole("button", { name: "Create Smart Wallet" }),
  ).toBeVisible();

  await page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Create Smart Wallet" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Create Smart Wallet" })).toBeHidden();

  await page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Create Smart Wallet" })).toBeVisible();
  await page.mouse.click(8, 8);
  await expect(page.getByRole("dialog", { name: "Create Smart Wallet" })).toBeHidden();

  await page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Create Smart Wallet" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByLabel("Dashboard overview").getByRole("button", { name: "Create Harness" }).click();
  await expect(page.getByRole("dialog", { name: "Create Harness" })).toBeVisible();
});

test("created agents appear in the dashboard and open detail pages", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await finishAgentWizard(page);
  await page.goto("/dashboard");

  const table = page.getByLabel("Smart wallets table");
  await expect(table.getByText("YieldGuard")).toBeVisible();
  await expect(table.getByText("Safe Approval Harness")).toBeVisible();
  await expect(table.getByText("Nexora Demo Model")).toBeVisible();
  await expect(table.getByText("conservative")).toBeVisible();
  await expect(table.getByText("Not created")).toBeVisible();
  await expect(table.getByText("Needs wallet")).toBeVisible();
  await expect(table.getByText("Benchmark")).toBeVisible();
  await expect(table.getByText("Create Wallet")).toBeVisible();

  await table.getByRole("button", { name: "View" }).click();
  await expect(page.getByRole("dialog", { name: "YieldGuard" })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("dashboard shows needs funding after wallet creation", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await finishAgentWizard(page);
  await page
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const createModal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await createModal.getByRole("button", { name: "Create Smart Wallet" }).click();
  await page.goto("/dashboard");

  const table = page.getByLabel("Smart wallets table");
  await expect(table.getByText("0x0000...0001")).toBeVisible();
  await expect(table.getByText("Needs funding")).toBeVisible();
  await expect(table.getByRole("button", { name: "Fund Wallet" })).toBeVisible();
  await table.getByRole("button", { name: "Fund Wallet" }).click();
  await expect(page.getByRole("dialog", { name: "FundWalletModal" })).toBeVisible();
});

test("funded wallet becomes ready to benchmark on the dashboard", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");

  await connectIfNeeded(page);
  await page.getByLabel("Smart Wallet Name").fill("YieldGuard");
  await finishAgentWizard(page);
  await page
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const createModal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await createModal.getByRole("button", { name: "Create Smart Wallet" }).click();

  await page.evaluate(() => {
    const state = JSON.parse(window.name) as Record<
      string,
      { agents: Array<Record<string, unknown>>; nextAgentId: number }
    >;
    const demoChain = state["nexora.demoChain"];
    demoChain.agents = demoChain.agents.map((agent) => ({
      ...agent,
      walletFundedAt: new Date().toISOString(),
      walletFundingTransactionHash:
        "0x1111111111111111111111111111111111111111111111111111111111111111",
    }));
    window.name = JSON.stringify(state);
  });

  await page.goto("/dashboard");

  const table = page.getByLabel("Smart wallets table");
  await expect(table.getByText("Ready to benchmark")).toBeVisible();
  await expect(table.getByRole("button", { name: "Run Test" })).toBeVisible();
});
