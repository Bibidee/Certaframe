"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { listContracts, listProofs } from "@/src/lib/storage";
import { CONTRACT_MISSING_MESSAGE, isContractConfigured } from "@/src/lib/genlayer/config";

export default function Page() {
  const { address } = useAccount();
  const [contracts, setContracts] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  useEffect(() => { listContracts().then(setContracts); listProofs().then(setProofs); }, []);

  // Awaiting *your* review (you are the client of a contract whose latest proof is unreviewed).
  const awaitingMine = address
    ? proofs.filter((p) => {
        if (p.status !== "PROOF_SUBMITTED" && p.status !== "UNDER_REVIEW") return false;
        if (p.verdict) return false;
        const c = contracts.find((x) => x.id === p.contractId);
        return c?.client && c.client.toLowerCase() === address.toLowerCase();
      })
    : [];

  // Worker needs to resubmit on contracts where revision was requested.
  const revisionMine = address
    ? contracts.filter((c) => c.status === "REVISION_REQUESTED" && c.worker?.toLowerCase() === address.toLowerCase())
    : [];

  const active = contracts.filter((c) => c.status === "ACTIVE").length;
  const awaiting = proofs.filter((p) => p.status === "PROOF_SUBMITTED").length;
  const accepted = proofs.filter((p) => p.verdict?.outcome === "ACCEPT").length;
  const revision = proofs.filter((p) => p.verdict?.outcome === "REQUEST_REVISION").length;
  const disputes = proofs.filter((p) => p.status === "DISPUTED" || Boolean(p.disputeId)).length;
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

      {awaitingMine.length > 0 && (
        <div className="glass-panel border-cyan2/60 mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="section-label">Inbox</span>
            <p className="text-sm text-optic mt-1">
              {awaitingMine.length} proof{awaitingMine.length > 1 ? "s" : ""} awaiting your review.
            </p>
          </div>
          <Link href={`/app/contracts/${awaitingMine[0].contractId}/review`} className="btn-review">
            Open Review
          </Link>
        </div>
      )}

      {revisionMine.length > 0 && (
        <div className="glass-panel border-amber2/60 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="section-label" style={{ color: "var(--amber2)" }}>Inbox</span>
            <p className="text-sm text-optic mt-1">
              {revisionMine.length} contract{revisionMine.length > 1 ? "s" : ""} awaiting your revised proof.
            </p>
          </div>
          <Link href={`/app/contracts/${revisionMine[0].id}/submit`} className="btn-seal">
            Resubmit Proof
          </Link>
        </div>
      )}

      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        <Stat label="Active Contracts" value={active} />
        <Stat label="Awaiting Review" value={awaiting} />
        <Stat label="Accepted" value={accepted} color="var(--lime2)" />
        <Stat label="Revisions" value={revision} color="var(--amber2)" />
        <Stat label="Disputes" value={disputes} color="var(--magma)" />
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
