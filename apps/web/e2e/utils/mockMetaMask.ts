import type { Page } from "@playwright/test";

export const ownerAddress = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
export const otherAddress = "0x1111111111111111111111111111111111111111";

export async function mockMetaMask(
  page: Page,
  initialChainId: string,
  address = ownerAddress,
) {
  await page.addInitScript(
    ({ walletAddress, chainId }) => {
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
          isNexoraMock: true,
          request: async ({
            method,
            params,
          }: {
            method: string;
            params?: Array<Record<string, string>>;
          }) => {
            if (method === "eth_requestAccounts") {
              accounts = [walletAddress];
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
    { walletAddress: address, chainId: initialChainId },
  );
}
