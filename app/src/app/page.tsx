import Link from "next/link";
import { Apparatus } from "@/components/apparatus";
import { CreatePact } from "@/components/create-pact";
import { MyPacts, RecentPacts } from "@/components/pact-list";
import { WalletButton } from "@/components/wallet";
import { explorerAddress, pactAddress, pactDeployed } from "@/lib/pact";
import { pactChain } from "@/lib/wagmi";

const CONTRACT_URL = pactDeployed ? explorerAddress(pactAddress) : null;
const SOURCE_URL = "https://github.com/mvirgiawancr/pact";

export default function Home() {
  return (
    <>
      {/* N9 edge-aligned nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 md:px-8">
        <Link href="/" className="font-display text-3xl leading-none text-ink" aria-label="pact home">pact</Link>
        <div className="flex items-center gap-4">
          <span className="label hidden sm:inline">{pactChain.name.toUpperCase()}</span>
          <WalletButton />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 md:px-8">
        {/* hero — split: statement left, apparatus right */}
        <section className="grid items-center gap-10 pb-16 pt-10 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="fade-in min-w-0">
            <p className="label">Escrow for freelance work</p>
            <h1 className="mt-4 text-[clamp(3rem,6.5vw+0.75rem,6rem)]">
              get <span className="verb">paid</span> for the work, not the promise
            </h1>
            <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-ink-2">
              The client locks payment in a smart contract before the work starts. Deliver, and it&apos;s released to you. Nothing delivered by the deadline? The client gets it back.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
              <a href="#create" className="btn btn-primary">create a pact</a>
              {CONTRACT_URL ? (
                <a href={CONTRACT_URL} className="link text-sm" target="_blank" rel="noreferrer">read the contract on {pactChain.name.toLowerCase()} ↗</a>
              ) : (
                <a href={SOURCE_URL} className="link text-sm" target="_blank" rel="noreferrer">read the contract source ↗</a>
              )}
            </div>
          </div>
          <div className="fade-in min-w-0" style={{ animationDelay: "120ms" }}>
            <Apparatus />
          </div>
        </section>

        {/* three-stat row: facts from the contract and its test suite */}
        <section className="grid grid-cols-1 border-y border-[var(--color-rule)] sm:grid-cols-3" aria-label="Contract facts">
          {[
            ["3 days", "Review window before the freelancer can claim"],
            ["21 / 21", "Contract tests passing, reentrancy included"],
            ["100%", "Line and branch coverage of Pact.sol"],
          ].map(([n, l]) => (
            <div key={n} className="border-[var(--color-rule)] py-6 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-0">
              <p className="num text-3xl text-ink">{n}</p>
              <p className="mt-1 text-sm text-muted">{l}</p>
            </div>
          ))}
        </section>

        {/* app — split studio: create left, your pacts right */}
        <section id="create" className="grid scroll-mt-8 gap-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <CreatePact />
          <MyPacts />
        </section>

        <section className="pb-20">
          <RecentPacts />
        </section>

        {/* how the money moves */}
        <section className="grid gap-10 border-t border-[var(--color-rule)] py-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 className="text-5xl">who can move the money, and when</h2>
          <dl className="divide-y divide-[var(--color-rule)] border-y border-[var(--color-rule)]">
            {[
              ["Client", "Releases the payment at any point, or takes it back once the deadline passes with nothing delivered."],
              ["Freelancer", "Marks the work delivered. If the client stays silent for 3 days after that, claims the payment directly."],
              ["Nobody else", "No platform wallet, no admin key, no fee. The contract holds the ETH and only follows these rules."],
            ].map(([who, what]) => (
              <div key={who} className="grid gap-2 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
                <dt className="label pt-1">{who}</dt>
                <dd className="leading-relaxed text-ink-2">{what}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      {/* Ft5 statement footer */}
      <footer className="border-t border-[var(--color-rule)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6 px-5 py-12 md:px-8">
          <p className="font-display text-4xl text-ink">the code is the contract.</p>
          <p className="text-sm text-muted">
            Testnet demo on {pactChain.name} · <a className="link" href={SOURCE_URL} target="_blank" rel="noreferrer">source</a> · built by{" "}
            <a className="link" href="https://contra.com/moch_virgiawan_caesar_r_w19nvsk6" target="_blank" rel="noreferrer">mvirgiawancr</a>
          </p>
        </div>
      </footer>
    </>
  );
}
