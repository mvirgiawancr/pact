import { formatEther, getAddress, isAddress, type Address } from "viem";
import { pactAbi } from "./pact-abi";
import { pactChain } from "./wagmi";

export { pactAbi };

export const pactAddress = (process.env.NEXT_PUBLIC_PACT_ADDRESS || "0x0000000000000000000000000000000000000000") as Address;
export const pactDeployed = !/^0x0{40}$/.test(pactAddress);
export const REVIEW_PERIOD = 3 * 24 * 60 * 60;

export const pact = { address: pactAddress, abi: pactAbi, chainId: pactChain.id } as const;

export const STATUS = ["none", "funded", "delivered", "released", "refunded"] as const;
export type StatusName = (typeof STATUS)[number];

export interface Deal {
  id: bigint;
  client: Address;
  freelancer: Address;
  amount: bigint;
  deadline: bigint;
  deliveredAt: bigint;
  status: StatusName;
  title: string;
}

export function toDeal(id: bigint, raw: {
  client: Address; freelancer: Address; amount: bigint; deadline: bigint; deliveredAt: bigint; status: number; title: string;
}): Deal {
  return { id, ...raw, status: STATUS[raw.status] ?? "none" };
}

export const short = (a: string) => {
  const c = isAddress(a) ? getAddress(a) : a;
  return `${c.slice(0, 6)}…${c.slice(-4)}`;
};

export function eth(wei: bigint) {
  const n = Number(formatEther(wei));
  return n >= 1 ? n.toLocaleString("en-US", { maximumFractionDigits: 4 }) : n.toPrecision(3).replace(/\.?0+$/, "");
}

export function dateLabel(unix: bigint | number) {
  return new Date(Number(unix) * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function explorerTx(hash: string) {
  return pactChain.blockExplorers?.default.url ? `${pactChain.blockExplorers.default.url}/tx/${hash}` : null;
}

export function explorerAddress(addr: string) {
  return pactChain.blockExplorers?.default.url ? `${pactChain.blockExplorers.default.url}/address/${addr}` : null;
}

/** viem errors carry a readable `shortMessage`; custom Solidity errors come back by name. */
export function readableError(e: unknown): string {
  const err = e as { shortMessage?: string; message?: string; name?: string };
  const msg = err.shortMessage || err.message || "Something went wrong.";
  if (/user rejected|denied/i.test(msg)) return "You cancelled the request in your wallet.";
  if (/insufficient funds/i.test(msg)) return "Not enough ETH in this wallet for the amount plus gas.";
  const custom = msg.match(/reverted with the following reason:\s*\n?\s*([A-Za-z]+)/)?.[1] ?? msg.match(/Error: ([A-Z][A-Za-z]+)\(/)?.[1];
  const map: Record<string, string> = {
    NoPayment: "Add an amount above zero.",
    InvalidFreelancer: "Use a different wallet address for the freelancer.",
    DeadlineInPast: "Pick a deadline in the future.",
    InvalidTitle: "Give the pact a title of up to 80 characters.",
    ReviewPeriodActive: "The client's review window is still open.",
    DeadlineNotReached: "Refunds open after the deadline passes.",
  };
  return (custom && map[custom]) || msg.split("\n")[0];
}
