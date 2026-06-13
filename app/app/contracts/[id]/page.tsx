"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getContract, proofsForContract } from "@/src/lib/storage";
import { GENLAYER_STUDIONET } from "@/src/lib/genlayer/config";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [proofs, setProofs] = useState<any[]>([]);
  useEffect(() => { getContract(id).then(setC); proofsForContract(id).then(setProofs); }, [id]);
  if (!c) return <main className="max-w-5xl mx-auto px-6 py-16 text-silver">Loading capsule…</main>;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <div className="glass-panel">
        <span className="section-label">01 / Proof Capsule Header</span>
        <h1 className="font-display text-4xl text-optic mt-1">{c.title}</h1>
        <div className="flex flex-wrap gap-3 mt-3 text-xs font-mono text-silver">
          <span>STATUS: <span className="text-lime2">{c.status}</span></span>
          <span>STRICTNESS: {c.strictness}</span>
          <span>DEADLINE: {c.deadline || "—"}</span>
          <span>LOCATION: {c.locationLabel || "—"}</span>
        </div>
        <div className="hash-strip mt-3">contract: {c.id}</div>
        {c.contractHash && <div className="hash-strip mt-1">hash: {c.contractHash}</div>}
        {c.txHash && (
          <div className="hash-strip mt-1">
            create tx:{" "}
            <a
              href={c.explorerUrl || `${GENLAYER_STUDIONET.explorerUrl}/tx/${c.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan2 underline"
            >
              {c.txHash}
            </a>
          </div>
        )}
      </div>

      <div className="glass-panel">
        <span className="section-label">02 / Task Terms Plate</span>
        <p className="text-sm text-bone mt-2 leading-relaxed">{c.description}</p>
      </div>

      <div className="glass-panel">
        <span className="section-label">03 / Acceptance Criteria Grid</span>
        <ul className="mt-2 grid md:grid-cols-2 gap-2">
          {(c.acceptanceCriteria || []).map((cr: string, i: number) => (
            <li key={i} className="border border-cyan2/20 p-3 text-sm text-optic">
              <span className="text-lime2 mr-2">▸</span>{cr}
            </li>
          ))}
        </ul>
      </div>

      <div className="glass-panel">
        <span className="section-label">04 / Proof Packet Timeline</span>
        {proofs.length === 0 ? (
          <p className="text-silver text-sm mt-2">No proofs submitted yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {proofs.map((p) => (
              <li key={p.id} className="border border-cyan2/20 p-3 flex justify-between items-center">
                <div>
                  <div className="font-mono text-xs text-silver">{p.id}</div>
                  <div className="text-xs mt-1">
                    Status: <span className="text-cyan2">{p.status}</span>
                    {p.verdict && <span className="ml-3">Verdict: <span className="text-lime2">{p.verdict.outcome}</span></span>}
                  </div>
                </div>
                <Link href={`/app/proofs/${p.id}`} className="btn-secondary">Open</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass-panel">
        <span className="section-label">05 / Action Gate</span>
        <div className="flex flex-wrap gap-3 mt-3">
          <Link href={`/app/contracts/${id}/submit`} className="btn-seal">Submit Proof</Link>
          <Link href={`/app/contracts/${id}/review`} className="btn-review">Run Visual Review</Link>
        </div>
      </div>
    </main>
  );
}
