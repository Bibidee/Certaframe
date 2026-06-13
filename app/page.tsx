import { EvidenceLightTableHero } from "@/components/EvidenceLightTableHero";
import Link from "next/link";

export default function Home() {
  return (
    <main>
      <EvidenceLightTableHero />
      <section className="max-w-7xl mx-auto px-6 py-20 grid md:grid-cols-3 gap-6">
        {[
          { t: "Hashes prove submission", d: "SHA-256 hashes lock the exact image bytes you submitted." },
          { t: "Signatures prove submitter", d: "EIP-712 signed proof envelopes attribute submission to a wallet." },
          { t: "GenLayer judges performance", d: "Multimodal validator consensus judges if visual evidence satisfies the task." },
        ].map((x, i) => (
          <div key={i} className="glass-panel">
            <span className="section-label">0{i + 1} / Pillar</span>
            <h3 className="font-display text-2xl mt-2 text-optic">{x.t}</h3>
            <p className="mt-2 text-sm text-silver leading-relaxed">{x.d}</p>
          </div>
        ))}
      </section>
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="glass-panel border-amber2/40">
          <span className="section-label">Safety</span>
          <p className="mt-2 text-sm text-bone leading-relaxed">
            CertaFrame provides AI-consensus review of submitted visual evidence. It does not guarantee authenticity,
            legality, safety compliance, or full real-world completion outside the submitted evidence.
          </p>
          <Link href="/safety" className="mt-3 inline-block btn-secondary">Read Safety Notes</Link>
        </div>
      </section>
    </main>
  );
}
