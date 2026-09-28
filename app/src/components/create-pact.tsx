"use client";
import { useState } from "react";
import { isAddress, parseEther, type Address } from "viem";
import { useConnection } from "wagmi";
import { useMounted, usePactTx } from "@/lib/hooks";
import { explorerTx, pactDeployed } from "@/lib/pact";
import { pactChain } from "@/lib/wagmi";

const tomorrow = () => {
  const d = new Date(Date.now() + 86400000);
  return d.toISOString().slice(0, 10);
};

type Errors = Partial<Record<"freelancer" | "amount" | "deadline" | "title", string>>;

export function CreatePact() {
  const mounted = useMounted();
  const { address, chainId, isConnected } = useConnection();
  const { state, send, reset } = usePactTx();
  const [form, setForm] = useState({ freelancer: "", amount: "", deadline: "", title: "" });
  const [errors, setErrors] = useState<Errors>({});

  const ready = mounted && isConnected && chainId === pactChain.id && pactDeployed;
  const busy = state.phase === "wallet" || state.phase === "pending";

  function validate(): Errors {
    const e: Errors = {};
    const f = form.freelancer.trim();
    if (!isAddress(f)) e.freelancer = "Paste a full wallet address, starting with 0x.";
    else if (address && f.toLowerCase() === address.toLowerCase()) e.freelancer = "That's your own wallet. Use the freelancer's address.";
    const amt = Number(form.amount);
    if (!form.amount || !(amt > 0)) e.amount = "Enter an amount above zero.";
    if (!form.deadline) e.deadline = "Pick a delivery date.";
    else if (new Date(form.deadline + "T23:59:59").getTime() <= Date.now()) e.deadline = "The deadline has to be in the future.";
    const t = form.title.trim();
    if (!t) e.title = "Describe the work in a few words.";
    else if (t.length > 80) e.title = "Keep it under 80 characters.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    const deadline = BigInt(Math.floor(new Date(form.deadline + "T23:59:59").getTime() / 1000));
    const ok = await send({
      functionName: "createDeal",
      args: [form.freelancer.trim() as Address, deadline, form.title.trim()],
      value: parseEther(form.amount),
    });
    if (ok) setForm({ freelancer: "", amount: "", deadline: "", title: "" });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined }));
    if (state.phase === "done" || state.phase === "error") reset();
  };

  const hint = !pactDeployed
    ? "The contract address isn't configured yet."
    : !mounted || !isConnected
      ? "Connect a wallet to create a pact."
      : chainId !== pactChain.id
        ? `Switch your wallet to ${pactChain.name}.`
        : null;

  return (
    <form onSubmit={submit} noValidate className="card space-y-5 p-6 md:p-8" aria-describedby="create-hint">
      <div>
        <p className="label">New pact</p>
        <h2 className="mt-2 text-4xl">lock the payment</h2>
      </div>

      <Field id="title" label="Work" error={errors.title}>
        <input id="title" className="field" placeholder="Landing page redesign" maxLength={80} value={form.title} onChange={set("title")} disabled={!ready || busy} aria-invalid={!!errors.title} />
      </Field>
      <Field id="freelancer" label="Freelancer wallet" error={errors.freelancer}>
        <input id="freelancer" className="field num" placeholder="0x…" spellCheck={false} autoComplete="off" value={form.freelancer} onChange={set("freelancer")} disabled={!ready || busy} aria-invalid={!!errors.freelancer} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="amount" label="Amount (ETH)" error={errors.amount}>
          <input id="amount" className="field num" inputMode="decimal" placeholder="0.01" value={form.amount} onChange={set("amount")} disabled={!ready || busy} aria-invalid={!!errors.amount} />
        </Field>
        <Field id="deadline" label="Deliver by" error={errors.deadline}>
          <input id="deadline" type="date" className="field num" min={mounted ? tomorrow() : undefined} value={form.deadline} onChange={set("deadline")} disabled={!ready || busy} aria-invalid={!!errors.deadline} />
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <button type="submit" className="btn btn-primary" disabled={!ready || busy} aria-busy={busy}>
          {state.phase === "wallet" ? "confirm in wallet…" : state.phase === "pending" ? "locking…" : "lock payment"}
        </button>
        <p id="create-hint" className="text-sm text-muted" role="status" aria-live="polite">
          {hint ?? <TxNote state={state} idle="Funds stay in the contract until release or refund." />}
        </p>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label mb-2 block">{label}</label>
      {children}
      {error && <p className="mt-1.5 text-sm text-accent-2" role="alert">{error}</p>}
    </div>
  );
}

export function TxNote({ state, idle }: { state: ReturnType<typeof usePactTx>["state"]; idle: string }) {
  if (state.phase === "wallet") return <>Waiting for your wallet…</>;
  if (state.phase === "pending" || state.phase === "done") {
    const url = explorerTx(state.hash);
    const text = state.phase === "pending" ? "Transaction sent, waiting for confirmation." : "Confirmed.";
    return url ? <>{text} <a className="link" href={url} target="_blank" rel="noreferrer">View on explorer ↗</a></> : <>{text}</>;
  }
  if (state.phase === "error") return <span className="text-accent-2">{state.message}</span>;
  return <>{idle}</>;
}
