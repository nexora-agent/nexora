import { expect, test, type Page } from "@playwright/test";

const ownerAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";

async function mockMetaMask(page: Page, initialChainId: string) {
  await page.addInitScript(
    ({ address, chainId }) => {
      let activeChainId = chainId;
      let accounts: string[] = [];
      const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

      const emit = (event: string, ...args: unknown[]) => {
        listeners.get(event)?.forEach((listener) => listener(...args));
      };

      Object.defineProperty(window, "ethereum", {
        configurable: true,
        value: {
          isMetaMask: true,
          request: async ({
            method,
            params,
          }: {
            method: string;
            params?: Array<Record<string, string>>;
          }) => {
            if (method === "eth_requestAccounts") {
              accounts = [address];
              emit("accountsChanged", accounts);
              return accounts;
            }

            if (method === "eth_accounts") {
              return accounts;
            }

            if (method === "eth_chainId") {
              return activeChainId;
            }

            if (method === "wallet_switchEthereumChain") {
              activeChainId = params?.[0]?.chainId ?? activeChainId;
              emit("chainChanged", activeChainId);
              return null;
            }

            if (method === "wallet_addEthereumChain") {
              activeChainId = params?.[0]?.chainId ?? activeChainId;
              emit("chainChanged", activeChainId);
              return null;
            }

            return null;
          },
          on: (event: string, listener: (...args: unknown[]) => void) => {
            const eventListeners = listeners.get(event) ?? new Set();
            eventListeners.add(listener);
            listeners.set(event, eventListeners);
          },
          removeListener: (
            event: string,
            listener: (...args: unknown[]) => void,
          ) => {
            listeners.get(event)?.delete(listener);
          },
        },
      });
    },
    { address: ownerAddress, chainId: initialChainId },
  );
}

test("connect wallet shows owner, Mantle network, and ready status", async ({
  page,
}) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText(/0x742d\.\.\.f44e/i)).toBeVisible();
  await expect(walletCard.getByText("Mantle Sepolia")).toBeVisible();
  await expect(walletCard.locator(".status-ready")).toHaveText("Ready");
});

test("wrong network asks the user to switch", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();

  await expect(page.getByText("Wrong network detected")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Switch to Mantle" }),
  ).toBeVisible();
});

test("switching to Mantle marks the wallet ready", async ({ page }) => {
  await mockMetaMask(page, "0x1");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Switch to Mantle" }).click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText("Mantle Sepolia")).toBeVisible();
  await expect(walletCard.locator(".status-ready")).toHaveText("Ready");
});

test("disconnect resets the wallet state", async ({ page }) => {
  await mockMetaMask(page, "0x138b");
  await page.goto("/");

  await page.getByRole("button", { name: "Connect MetaMask" }).first().click();
  await page.getByRole("button", { name: "Disconnect" }).click();

  const walletCard = page.getByLabel("Owner wallet status");
  await expect(walletCard.getByText("Not connected").first()).toBeVisible();
  await expect(walletCard.locator(".status-disconnected")).toHaveText(
    "Disconnected",
  );
});
