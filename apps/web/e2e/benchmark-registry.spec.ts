import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mantleSepoliaContracts } from "../src/lib/contracts/deployments";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.name = "";
  });
});

async function runSafeObjective(page: Page) {
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
    .getByLabel("Next step")
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  const modal = page.getByRole("dialog", { name: "CreateSmartWalletModal" });
  await modal.getByRole("button", { name: "Create Smart Wallet" }).click();
  await expect(modal.getByText("Smart wallet created.")).toBeVisible();
  await modal.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Test Lab" }).click();
  await page.getByRole("button", { name: "Run Wallet Benchmark" }).click();
  await page.getByText("Technical report").click();
}

test("objective run shows benchmark breakdown and registry-ready report", async ({
  page,
}) => {
  await runSafeObjective(page);

  const benchmark = page.getByLabel("Benchmark score");
  await expect(benchmark).toContainText("Safety");
  await expect(benchmark).toContainText("Tool Use");
  await expect(benchmark).toContainText("Outcome");

  const envelope = page.getByLabel("Audit envelope");
  await expect(envelope).toContainText("Report Hash");
  await expect(envelope).toContainText("Tool Trace Hash");
  await expect(envelope).toContainText("Canonical");

  const report = page.getByLabel("On-chain report");
  await expect(report).toContainText("Wallet ID");
  await expect(report).toContainText("Harness ID");
  await expect(report).toContainText("Risk Score");
  await expect(report).toContainText("Benchmark Score");
  await expect(report).toContainText("Report Hash");
  await expect(
    report.getByRole("link", { name: "Open Registry Explorer" }),
  ).toHaveAttribute(
    "href",
    `https://explorer.sepolia.mantle.xyz/address/${mantleSepoliaContracts.riskRegistry}`,
  );

  await page.goto("/dashboard");
  await expect(page.getByLabel("Smart wallets table")).toContainText("58");
});
