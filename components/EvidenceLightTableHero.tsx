import Link from "next/link";

export function EvidenceLightTableHero() {
  return (
    <section className="relative overflow-hidden">
      <div className="lens-grid absolute inset-0 opacity-50" />
      <div className="relative max-w-7xl mx-auto px-6 py-24 grid lg:grid-cols-3 gap-6 items-stretch">
        <Frame label="BEFORE" hash="0x83f…c21" tone="amber" />
        <div className="glass-panel flex flex-col items-center justify-center text-center min-h-[360px]">
          <span className="section-label mb-3">01 / Centre Lens</span>
          <h1 className="font-display text-5xl md:text-6xl text-optic leading-none mb-3">CERTAFRAME</h1>
          <p className="font-mono text-xs uppercase tracking-[0.25em] text-cyan2 mb-6">
            Verified work, judged by AI consensus.
          </p>
          <p className="text-sm text-silver max-w-xs mb-6">
            Hashes prove submission. GenLayer judges performance.
          </p>
          <Link href="/app/contracts/new" className="btn-primary inline-flex items-center">
            <span className="lens-circle" />Create Proof Contract
          </Link>
          <Link href="/app/console" className="mt-4 btn-secondary">Open Evidence Console</Link>
        </div>
        <Frame label="AFTER" hash="0xa19…9ee" tone="lime" />
      </div>
      <div className="border-t border-cyan2/20 bg-lens/60 py-4">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap justify-between gap-2 font-mono text-[10px] tracking-[0.2em] uppercase text-silver">
          <span>TASK TERMS</span><span className="text-cyan2">→</span>
          <span>SIGNED PROOF</span><span className="text-cyan2">→</span>
          <span>GENLAYER REVIEW</span><span className="text-cyan2">→</span>
          <span className="text-lime2">ACTION GATE</span>
        </div>
      </div>
    </section>
  );
}

function Frame({ label, hash, tone }: { label: string; hash: string; tone: "amber" | "lime" }) {
  const accent = tone === "amber" ? "border-amber2/60" : "border-lime2/60";
  return (
    <div className={`glass-panel min-h-[360px] flex flex-col ${accent}`}>
      <div className="flex justify-between items-center mb-3">
        <span className="section-label">{label}</span>
        <span className="crack-mark" style={{ color: tone === "amber" ? "var(--amber2)" : "var(--lime2)", borderColor: tone === "amber" ? "var(--amber2)" : "var(--lime2)" }}>
          ILLUSTRATIVE
        </span>
      </div>
      <div className="flex-1 border border-dashed border-cyan2/30 rounded-sm flex items-center justify-center text-silver text-xs font-mono">
        EVIDENCE FRAME
      </div>
      <div className="hash-strip mt-3">hash: {hash}</div>
    </div>
  );
}
