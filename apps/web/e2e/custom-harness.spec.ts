import { expect, test } from "@playwright/test";
import { mockMetaMask } from "./utils/mockMetaMask";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.name = "";
  });
});

async function finishAgentWizard(page: import("@playwright/test").Page) {
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

test("user creates a custom harness and assigns it to an agent", async ({
  page,
}) => {
  await page.goto("/harnesses/new");
  await page.getByLabel("Harness Name").fill("Aave Guard Harness");
  await page.getByLabel("Runtime Instructions").fill(
    "Inspect pool state before proposing bounded deposit intents.",
  );
  await page.getByLabel("Tool Name").fill("read_aave_reserve");
  await page.getByLabel("Tool Kind").selectOption("contract-read");
  await page.getByLabel("Tool Description").fill("Read Aave reserve data.");
  await page.getByRole("button", { name: "Add Tool" }).click();
  await page.getByRole("button", { name: "Save Harness" }).click();

  await expect(page).toHaveURL(/\/harnesses/);
  await expect(page.getByText("Aave Guard Harness")).toBeVisible();
  await expect(page.getByText("read_aave_reserve")).toBeVisible();

  await mockMetaMask(page, "0x138b");
  await page.goto("/create-wallet");
  await finishAgentWizard(page);

  await page.getByRole("button", { name: "Edit Setup" }).click();
  const selector = page.getByLabel("Harness selector");
  await selector.getByRole("button", { name: "Aave Guard Harness" }).click();
  await selector.getByRole("button", { name: "Save Harness" }).click();

  await page.goto("/dashboard");
  await expect(
    page.getByLabel("Smart wallets table").getByText("Aave Guard Harness"),
  ).toBeVisible();
});
