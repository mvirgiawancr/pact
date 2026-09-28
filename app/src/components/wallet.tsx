"use client";
import { useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { useMounted } from "@/lib/hooks";
import { short } from "@/lib/pact";
import { pactChain } from "@/lib/wagmi";

export function WalletButton() {
  const mounted = useMounted();
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  if (!mounted) return <span className="btn btn-ghost" aria-hidden>connect wallet</span>;

  if (isConnected && address) {
    if (chainId !== pactChain.id) {
      return (
        <button className="btn btn-primary" onClick={() => switchChain.mutate({ chainId: pactChain.id })} disabled={switchChain.isPending}>
          {switchChain.isPending ? "switching…" : `switch to ${pactChain.name.toLowerCase()}`}
        </button>
      );
    }
    return (
      <button className="btn btn-ghost group" onClick={() => disconnect.mutate()} title="Disconnect">
        <i className="h-2 w-2 rounded-full bg-ok" aria-hidden />
        <span className="num text-sm normal-case group-hover:hidden">{short(address)}</span>
        <span className="hidden text-sm group-hover:inline">disconnect</span>
      </button>
    );
  }

  async function go(id: string) {
    setError("");
    const c = connectors.find((x) => x.uid === id);
    if (!c) return;
    try {
      await connect.mutateAsync({ connector: c, chainId: pactChain.id });
      setOpen(false);
    } catch (e) {
      const msg = (e as Error).message || "";
      setError(/provider not found|ProviderNotFound/i.test(msg) ? "No browser wallet found. Install MetaMask or Rabby, then try again." : /reject/i.test(msg) ? "You cancelled the connection." : "Couldn't connect. Try again.");
    }
  }

  if (connectors.length === 1) {
    return (
      <div className="relative flex flex-col items-end">
        <button className="btn btn-primary" onClick={() => go(connectors[0].uid)} disabled={connect.isPending}>
          {connect.isPending ? "connecting…" : "connect wallet"}
        </button>
        {error && <p role="alert" className="absolute top-full mt-2 w-64 text-right text-xs text-accent-2">{error}</p>}
      </div>
    );
  }

  return (
    <div className="relative">
      <button className="btn btn-primary" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        connect wallet
      </button>
      {open && (
        <div className="card absolute right-0 top-full z-20 mt-2 w-60 p-2">
          {connectors.map((c) => (
            <button key={c.uid} onClick={() => go(c.uid)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-ink hover:bg-paper-3">
              {c.id === "mock" ? "test wallet (anvil)" : c.id === "injected" ? "browser wallet" : c.name.toLowerCase()}
              <span className="label">{c.id === "mock" ? "DEV" : "BROWSER"}</span>
            </button>
          ))}
          {error && <p role="alert" className="px-3 py-2 text-xs text-accent-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
