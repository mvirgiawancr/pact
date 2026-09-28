"use client";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { useMounted, useMyDeals, useNow, usePactTx, useRecentDeals } from "@/lib/hooks";
import { dateLabel, eth, pactDeployed, REVIEW_PERIOD, short, type Deal, type StatusName } from "@/lib/pact";
import { pactChain } from "@/lib/wagmi";
import { TxNote } from "./create-pact";

const STATUS_STYLE: Record<StatusName, string> = {
  none: "text-muted",
  funded: "text-accent",
  delivered: "text-ink",
  released: "text-ok",
  refunded: "text-muted",
};

export function MyPacts() {
  const mounted = useMounted();
  const { address, isConnected, chainId } = useConnection();
  const { deals, isLoading, isError } = useMyDeals(mounted && isConnected ? address : undefined);

  return (
    <section aria-labelledby="mine-title" className="card p-6 md:p-8">
      <p className="label">Your pacts</p>
      <h2 id="mine-title" className="mt-2 text-4xl">where things stand</h2>
      <div className="mt-6">
        {!mounted || !isConnected ? (
          <Empty text="Connect a wallet to see the pacts you're part of, as a client or a freelancer." />
        ) : chainId !== pactChain.id ? (
          <Empty text={`Your wallet is on another network. Switch to ${pactChain.name} to see your pacts.`} />
        ) : isLoading ? (
          <Skeleton />
        ) : isError ? (
          <Empty text="Couldn't read the contract right now. Refresh to try again." />
        ) : deals.length === 0 ? (
          <Empty text="No pacts yet. Create one to lock your first payment." />
        ) : (
          <ul className="divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
            {deals.map((d) => <PactRow key={d.id.toString()} deal={d} me={address!} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

export function RecentPacts() {
  const { deals, total, isLoading } = useRecentDeals(5);
  if (!pactDeployed) return null;
  return (
    <section aria-labelledby="recent-title">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-title" className="text-4xl">latest on {pactChain.name.toLowerCase()}</h2>
        <p className="label num">{total.toString()} PACTS TOTAL</p>
      </div>
      <div className="mt-6">
        {isLoading ? <Skeleton /> : deals.length === 0 ? (
          <Empty text="Nobody has created a pact on this contract yet." />
        ) : (
          <ul className="divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
            {deals.map((d) => <PactRow key={d.id.toString()} deal={d} />)}
          </ul>
        )}
      </div>
    </section>
  );
}

function PactRow({ deal: d, me }: { deal: Deal; me?: Address }) {
  const now = useNow();
  const tx = usePactTx();
  const role = me ? (d.client.toLowerCase() === me.toLowerCase() ? "client" : d.freelancer.toLowerCase() === me.toLowerCase() ? "freelancer" : null) : null;
  const claimableAt = Number(d.deliveredAt) + REVIEW_PERIOD;
  const pastDeadline = now > 0 && now > Number(d.deadline);
  const busy = tx.state.phase === "wallet" || tx.state.phase === "pending";
  const act = (functionName: "markDelivered" | "release" | "claim" | "refund") => tx.send({ functionName, args: [d.id] });

  const actions: { label: string; fn: () => void; primary?: boolean; disabled?: boolean; note?: string }[] = [];
  if (role === "freelancer") {
    if (d.status === "funded") actions.push({ label: "mark delivered", fn: () => act("markDelivered"), primary: true });
    if (d.status === "delivered") {
      const open = now >= claimableAt;
      actions.push({ label: "claim payment", fn: () => act("claim"), primary: true, disabled: !open, note: open ? undefined : `Claimable ${dateLabel(claimableAt)}` });
    }
    if (d.status === "funded" || d.status === "delivered") actions.push({ label: "return funds", fn: () => act("refund") });
  }
  if (role === "client") {
    if (d.status === "funded" || d.status === "delivered") actions.push({ label: "release payment", fn: () => act("release"), primary: true });
    if (d.status === "funded") actions.push({ label: "refund", fn: () => act("refund"), disabled: !pastDeadline, note: pastDeadline ? undefined : `Refund opens after ${dateLabel(d.deadline)}` });
  }

  return (
    <li className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="label num">#{d.id.toString()}</span>
          <p className="truncate text-lg text-ink">{d.title}</p>
          <span className={`label ${STATUS_STYLE[d.status]}`}>{d.status}</span>
          {role && <span className="label rounded-full border border-[var(--color-rule-2)] px-2 py-0.5">YOU · {role}</span>}
        </div>
        <p className="num mt-1.5 text-sm text-muted">
          <span className="text-ink">{eth(d.amount)} ETH</span> · {short(d.client)} → {short(d.freelancer)} · due {dateLabel(d.deadline)}
        </p>
        {actions.some((a) => a.note) && <p className="mt-1.5 text-sm text-muted">{actions.find((a) => a.note)?.note}</p>}
        {tx.state.phase !== "idle" && (
          <p className="mt-1 text-sm text-muted" role="status" aria-live="polite">
            <TxNote state={tx.state} idle="" />
          </p>
        )}
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button key={a.label} onClick={a.fn} disabled={busy || a.disabled} className={`btn ${a.primary ? "btn-primary" : "btn-ghost"} min-h-9 px-4 text-sm`}>
              {a.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-[var(--color-rule-2)] px-5 py-8 text-center text-sm text-muted">{text}</p>;
}

function Skeleton() {
  return (
    <div className="space-y-3" aria-label="Loading pacts">
      {[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-paper-3" />)}
    </div>
  );
}
