import { injected } from "@wagmi/core";
import { http, createConfig } from "wagmi";
import { mainnet } from "wagmi/chains";
import { mantleSepolia } from "@/lib/chains/mantle";

export const wagmiConfig = createConfig({
  chains: [mantleSepolia, mainnet],
  connectors: [injected()],
  transports: {
    [mantleSepolia.id]: http("https://mantle-sepolia.g.alchemy.com/v2/WUHHfgnpLvICz941qwVswahyQq1wGzXX"),
    [mainnet.id]: http(),
  },
});
