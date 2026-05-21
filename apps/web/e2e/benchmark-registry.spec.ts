import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
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
    .getByRole("region", { name: "Smart wallet", exact: true })
    .getByRole("button", { name: "Create Smart Wallet" })
    .click();
  await page
    .getByLabel("Objective runner")
    .getByRole("button", { name: "Run Objective" })
    .click();
}

test("objective run shows benchmark breakdown and registry-ready report", async ({
  page,
}) => {
  await runSafeObjective(page);

  const benchmark = page.getByLabel("Benchmark score");
  await expect(benchmark).toContainText("Safety");
  await expect(benchmark).toContainText("Tool Use");
  await expect(benchmark).toContainText("Outcome");

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
    "https://explorer.sepolia.mantle.xyz/address/0x9C854c49954EC1C494132C75115E9f82477A335F",
  );

  await page.goto("/dashboard");
  await expect(page.getByLabel("Smart wallets table")).toContainText("90");
});
