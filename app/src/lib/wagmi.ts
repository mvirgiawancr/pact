import { createConfig, http } from "wagmi";
import { injected, mock } from "wagmi/connectors";
import { baseSepolia, foundry } from "wagmi/chains";

/**
 * NEXT_PUBLIC_PACT_CHAIN = "base-sepolia" (default) | "anvil"
 * NEXT_PUBLIC_MOCK_WALLET = "1" adds a test wallet backed by anvil's unlocked dev accounts.
 * The mock wallet is for local development only and is ignored unless the chain is anvil.
 */
export const useAnvil = process.env.NEXT_PUBLIC_PACT_CHAIN === "anvil";
export const pactChain = useAnvil ? foundry : baseSepolia;

// anvil's first two default dev accounts (public test accounts, never funded on real networks)
const ANVIL_ACCOUNTS = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
] as const;

const connectors =
  useAnvil && process.env.NEXT_PUBLIC_MOCK_WALLET === "1"
    ? [injected(), mock({ accounts: ANVIL_ACCOUNTS, features: { reconnect: true } })]
    : [injected()];

export const wagmiConfig = createConfig({
  chains: [pactChain],
  connectors,
  transports: { [pactChain.id]: http() } as Record<number, ReturnType<typeof http>>,
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
