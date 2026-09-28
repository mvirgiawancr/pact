/** The page's one built artefact: client → vault → freelancer, with leader-line callouts. */
export function Apparatus() {
  const mono = { fontFamily: "var(--font-label)", fontSize: 11, letterSpacing: "0.12em", fill: "var(--color-muted)" };
  const ink = { fill: "var(--color-ink)", fontFamily: "var(--font-display)", fontSize: 26 };
  return (
    <svg viewBox="0 0 560 460" className="h-auto w-full" role="img"
      aria-label="Diagram: the client's ETH is locked in the Pact contract, then released to the freelancer on delivery, or refunded if the deadline passes.">
      <defs>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="oklch(86% 0.15 60)" />
          <stop offset=".45" stopColor="oklch(76% 0.17 50)" />
          <stop offset="1" stopColor="oklch(76% 0.17 50)" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* rails */}
      <path d="M92 230 H214" stroke="var(--color-rule-2)" strokeWidth="1.5" />
      <path d="M346 230 H468" stroke="var(--color-rule-2)" strokeWidth="1.5" />
      <path className="flow" d="M92 230 H214" stroke="var(--color-accent)" strokeWidth="1.5" />
      <path className="flow" d="M346 230 H468" stroke="var(--color-accent)" strokeWidth="1.5" />
      {/* refund path */}
      <path d="M280 318 V372 Q280 392 260 392 H92 Q72 392 72 372 V300" fill="none" stroke="var(--color-rule)" strokeWidth="1.5" strokeDasharray="3 5" />

      {/* parties */}
      <g>
        <circle cx="62" cy="230" r="30" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" />
        <circle cx="62" cy="230" r="5" fill="var(--color-ink)" />
        <text x="62" y="284" textAnchor="middle" style={{ ...mono, fill: "var(--color-ink)" }}>CLIENT</text>
        <circle cx="498" cy="230" r="30" fill="var(--color-paper-2)" stroke="var(--color-rule-2)" />
        <circle cx="498" cy="230" r="5" fill="var(--color-ink)" />
        <text x="498" y="284" textAnchor="middle" style={{ ...mono, fill: "var(--color-ink)" }}>FREELANCER</text>
      </g>

      {/* vault */}
      <g>
        <circle className="emit" cx="280" cy="230" r="118" fill="url(#core)" opacity=".5" />
        <rect x="214" y="148" width="132" height="170" rx="18" fill="var(--color-paper-2)" stroke="var(--color-accent)" strokeWidth="1.5" />
        <circle cx="280" cy="212" r="34" fill="none" stroke="var(--color-rule-2)" strokeWidth="1.5" />
        <circle className="emit" cx="280" cy="212" r="12" fill="var(--color-accent)" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <line key={a} x1="280" y1="182" x2="280" y2="188" stroke="var(--color-rule-2)" strokeWidth="2" transform={`rotate(${a} 280 212)`} />
        ))}
        <text x="280" y="276" textAnchor="middle" style={ink}>pact</text>
        <text x="280" y="298" textAnchor="middle" style={mono}>ESCROW</text>
      </g>

      {/* leader-line callouts: left, top, right — never sharing a row */}
      <g style={mono}>
        <path d="M150 230 V150 H40" fill="none" stroke="var(--color-rule-2)" />
        <text x="40" y="126">01 · DEPOSIT</text>
        <text x="40" y="142" style={{ ...mono, fill: "var(--color-neutral)" }}>ETH LOCKED</text>

        <path d="M280 148 V70" fill="none" stroke="var(--color-rule-2)" />
        <text x="280" y="44" textAnchor="middle">02 · DELIVERED</text>
        <text x="280" y="60" textAnchor="middle" style={{ ...mono, fill: "var(--color-neutral)" }}>3-DAY REVIEW WINDOW</text>

        <path d="M410 230 V150 H520" fill="none" stroke="var(--color-rule-2)" />
        <text x="520" y="126" textAnchor="end">03 · RELEASE</text>
        <text x="520" y="142" textAnchor="end" style={{ ...mono, fill: "var(--color-neutral)" }}>PAID OUT</text>

        <text x="100" y="418">REFUND · IF NOTHING ARRIVES BY THE DEADLINE</text>
      </g>
    </svg>
  );
}
