"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { listProofs } from "@/src/lib/storage";
import { CONTRACT_MISSING_MESSAGE, isContractConfigured } from "@/src/lib/genlayer/config";
import { fetchProtocolStats, fetchUserContracts, ProtocolStats } from "@/src/lib/genlayer/queries";

export default function Page() {
  const { address } = useAccount();
  const [contracts, setContracts] = useState<any[]>([]);
  const [proofs, setProofs] = useState<any[]>([]);
  const [stats, setStats] = useState<ProtocolStats | null>(null);
  const [source, setSource] = useState<"chain" | "cache">("cache");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const [s, c, p] = await Promise.all([
      fetchProtocolStats(),
      address ? fetchUserContracts(address) : Promise.resolve([]),
      listProofs(),
    ]);
    if (s) { setStats(s); setSource("chain"); }
    else setSource("cache");
    setContracts(c);
    setProofs(p);
    setRefreshing(false);
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [address]);

  // Tile values: prefer on-chain stats when available, fall back to derived counts.
  const myActive = contracts.filter((c) => c.status === "ACTIVE").length;
  const myAwaiting = contracts.filter((c) => c.status === "PROOF_SUBMITTED").length;
  const myAccepted = contracts.filter((c) => c.status === "ACCEPTED").length;
  const myRevisions = contracts.filter((c) => c.status === "REVISION_REQUESTED").length;
  const myDisputes = contracts.filter((c) => c.status === "DISPUTED").length;

  const reviewedProofs = proofs.filter((p) => p.verdict?.confidence != null);
  const avgConfidence = reviewedProofs.length
    ? reviewedProofs.reduce((s, p) => s + (p.verdict.confidence || 0), 0) / reviewedProofs.length
    : 0;

  const awaitingMine = address
    ? proofs.filter((p) => {
        if (p.status !== "PROOF_SUBMITTED" && p.status !== "UNDER_REVIEW") return false;
        if (p.verdict) return false;
        const c = contracts.find((x) => x.id === p.contractId);
        return c?.client && c.client.toLowerCase() === address.toLowerCase();
      })
    : [];

  const revisionMine = address
    ? contracts.filter((c) => c.status === "REVISION_REQUESTED" && c.worker?.toLowerCase() === address.toLowerCase())
    : [];

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="section-label">Dashboard</span>
          <h1 className="font-display text-5xl text-optic">Capsule Board</h1>
          <p className="text-[10px] font-mono uppercase tracking-widest text-silver mt-1">
            Source: <span className={source === "chain" ? "text-lime2" : "text-amber2"}>{source}</span>
            {refreshing && <span className="text-cyan2"> · refreshing</span>}
            <button onClick={refresh} className="ml-3 text-cyan2 underline">refresh</button>
          </p>
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
        <Stat label="Active Contracts" value={myActive} />
        <Stat label="Awaiting Review" value={myAwaiting} />
        <Stat label="Accepted" value={myAccepted} color="var(--lime2)" />
        <Stat label="Revisions" value={myRevisions} color="var(--amber2)" />
        <Stat label="Disputes" value={myDisputes} color="var(--magma)" />
        <Stat label="Avg Confidence" value={`${(avgConfidence * 100).toFixed(0)}%`} color="var(--cyan2)" />
      </div>

      {stats && (
        <div className="glass-panel mb-8">
          <span className="section-label">Protocol Totals · live from CertaFrameVerifier</span>
          <div className="grid md:grid-cols-4 lg:grid-cols-8 gap-3 mt-3 text-xs font-mono">
            <Mini label="Contracts" v={stats.contracts} />
            <Mini label="Proofs" v={stats.proofs} />
            <Mini label="Reviews" v={stats.reviews} />
            <Mini label="Disputes" v={stats.disputes} />
            <Mini label="Accept" v={stats.accept} c="var(--lime2)" />
            <Mini label="Revision" v={stats.revision} c="var(--amber2)" />
            <Mini label="Insufficient" v={stats.insufficient} c="var(--amber2)" />
            <Mini label="Escalate" v={stats.escalate} c="var(--uv)" />
          </div>
        </div>
      )}

      <span className="section-label">My Capsules</span>
      <div className="mt-3 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.length === 0 && <div className="glass-panel text-sm text-silver">No proof contracts yet.</div>}
        {contracts.map((c) => (
          <Link key={c.id} href={`/app/contracts/${c.id}`} className="glass-panel hover:border-cyan2 transition">
            <span className="section-label">{c.status}</span>
            <h3 className="font-head text-lg text-optic mt-1">{c.title || "Untitled"}</h3>
            <p className="text-xs text-silver mt-2 line-clamp-2">{c.description}</p>
            <div className="hash-strip mt-3">{c.id?.slice(0, 22)}…</div>
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

function Mini({ label, v, c }: { label: string; v: number; c?: string }) {
  return (
    <div className="border border-cyan2/15 p-2 rounded-sm">
      <div className="text-[10px] uppercase tracking-widest text-silver">{label}</div>
      <div className="font-display text-xl" style={{ color: c || "var(--optic)" }}>{v}</div>
    </div>
  );
}
