"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listContracts, listProofs } from "@/src/lib/storage";
import { CONTRACT_MISSING_MESSAGE, isContractConfigured } from "@/src/lib/genlayer/config";

export default function Page() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  useEffect(() => { listContracts().then(setContracts); listProofs().then(setProofs); }, []);

  const active = contracts.filter((c) => c.status === "ACTIVE").length;
  const awaiting = proofs.filter((p) => p.status === "PROOF_SUBMITTED").length;
  const accepted = proofs.filter((p) => p.verdict?.outcome === "ACCEPT").length;
  const revision = proofs.filter((p) => p.verdict?.outcome === "REQUEST_REVISION").length;
  const escalations = proofs.filter((p) => p.verdict?.outcome === "ESCALATE_TO_HUMAN").length;
  const avgConf = proofs.length
    ? (proofs.reduce((s, p) => s + (p.verdict?.confidence || 0), 0) / proofs.filter((p) => p.verdict).length || 0)
    : 0;

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="section-label">Dashboard</span>
          <h1 className="font-display text-5xl text-optic">Capsule Board</h1>
        </div>
        <Link href="/app/contracts/new" className="btn-primary"><span className="lens-circle"/>Create Proof Contract</Link>
      </div>

      {!isContractConfigured() && (
        <div className="glass-panel border-amber2/40 mb-6 whitespace-pre-line text-sm text-bone">
          {CONTRACT_MISSING_MESSAGE}
        </div>
      )}

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Stat label="Active Contracts" value={active} />
        <Stat label="Awaiting Review" value={awaiting} />
        <Stat label="Accepted" value={accepted} color="var(--lime2)" />
        <Stat label="Revisions" value={revision} color="var(--amber2)" />
        <Stat label="Escalations" value={escalations} color="var(--uv)" />
        <Stat label="Avg Confidence" value={`${(avgConf * 100).toFixed(0)}%`} color="var(--cyan2)" />
      </div>

      <span className="section-label">Active Capsules</span>
      <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.length === 0 && <div className="glass-panel text-sm text-silver">No proof contracts yet.</div>}
        {contracts.map((c) => (
          <Link key={c.id} href={`/app/contracts/${c.id}`} className="glass-panel hover:border-cyan2 transition">
            <span className="section-label">{c.status}</span>
            <h3 className="font-head text-lg text-optic mt-1">{c.title}</h3>
            <p className="text-xs text-silver mt-2 line-clamp-2">{c.description}</p>
            <div className="hash-strip mt-3">{c.id.slice(0, 22)}…</div>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="glass-panel">
      <span className="section-label">{label}</span>
      <p className="font-display text-3xl mt-1" style={{ color: color || "var(--optic)" }}>{value}</p>
    </div>
  );
}
