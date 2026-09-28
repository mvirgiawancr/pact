"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { useConfig, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { pact, pactDeployed, readableError, toDeal, type Deal } from "./pact";

/** true after hydration — wallet state only exists in the browser */
export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/* A shared clock (unix seconds) that ticks every 15 s, so time-based buttons unlock on their own. */
let nowCache = Math.floor(Date.now() / 1000);
const nowSubs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subscribeNow(fn: () => void) {
  nowSubs.add(fn);
  if (!timer) timer = setInterval(() => { nowCache = Math.floor(Date.now() / 1000); nowSubs.forEach((f) => f()); }, 15000);
  return () => {
    nowSubs.delete(fn);
    if (!nowSubs.size && timer) { clearInterval(timer); timer = null; }
  };
}
export function useNow() {
  return useSyncExternalStore(subscribeNow, () => nowCache, () => 0);
}

type RawDeal = Parameters<typeof toDeal>[1];

/** Poll so the other party's actions show up without a reload. */
const REFRESH = 12_000;

function useDeals(ids: readonly bigint[] | undefined) {
  const res = useReadContracts({
    contracts: (ids ?? []).map((id) => ({ ...pact, functionName: "getDeal" as const, args: [id] as const })),
    query: { enabled: pactDeployed && !!ids?.length, refetchInterval: REFRESH },
  });
  const deals: Deal[] = (res.data ?? [])
    .map((r, i) => (r.status === "success" ? toDeal(ids![i], r.result as unknown as RawDeal) : null))
    .filter((d): d is Deal => d !== null);
  return { deals, isLoading: res.isLoading, isError: res.isError };
}

export function useMyDeals(account: Address | undefined) {
  const ids = useReadContract({ ...pact, functionName: "dealsOf", args: account ? [account] : undefined, query: { enabled: pactDeployed && !!account, refetchInterval: REFRESH } });
  const list = ids.data ? [...ids.data].reverse() : undefined;
  const { deals, isLoading } = useDeals(list);
  return { deals, isLoading: ids.isLoading || isLoading, isError: ids.isError };
}

export function useRecentDeals(limit = 5) {
  const count = useReadContract({ ...pact, functionName: "dealCount", query: { enabled: pactDeployed, refetchInterval: REFRESH } });
  const n = count.data ?? 0n;
  const ids: bigint[] = [];
  for (let i = n; i > 0n && ids.length < limit; i--) ids.push(i);
  const { deals, isLoading } = useDeals(ids);
  return { deals, total: n, isLoading: count.isLoading || isLoading, isError: count.isError };
}

export type TxState = { phase: "idle" } | { phase: "wallet" } | { phase: "pending"; hash: `0x${string}` } | { phase: "done"; hash: `0x${string}` } | { phase: "error"; message: string };

export type PactWrite =
  | { functionName: "createDeal"; args: readonly [Address, bigint, string]; value: bigint }
  | { functionName: "markDelivered" | "release" | "claim" | "refund"; args: readonly [bigint] };

/** Send a Pact transaction, wait for it to land, then refresh every contract read. */
export function usePactTx() {
  const config = useConfig();
  const qc = useQueryClient();
  const { mutateAsync } = useWriteContract();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  async function send(req: PactWrite) {
    setState({ phase: "wallet" });
    try {
      const hash = await mutateAsync({ ...pact, ...req } as Parameters<typeof mutateAsync>[0]);
      setState({ phase: "pending", hash });
      const receipt = await waitForTransactionReceipt(config, { hash });
      if (receipt.status !== "success") throw new Error("The transaction was reverted.");
      setState({ phase: "done", hash });
      await qc.invalidateQueries();
      return true;
    } catch (e) {
      setState({ phase: "error", message: readableError(e) });
      return false;
    }
  }
  return { state, send, reset: () => setState({ phase: "idle" }) };
}
