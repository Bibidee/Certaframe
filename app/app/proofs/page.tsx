"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { fetchUserContracts, fetchProofsForContract } from "@/src/lib/genlayer/queries";

export default function Page() {
  const { address } = useAccount();
  const [proofs, setProofs] = useState<any[]>([]);

  useEffect(() => {
    if (!address) return;
    fetchUserContracts(address).then(async (contracts) => {
      const nested = await Promise.all(contracts.map((c: any) => fetchProofsForContract(c.id)));
      setProofs(nested.flat());
    });
  }, [address]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <span className="section-label">All Proofs</span>
      <h1 className="font-display text-5xl text-optic mb-8">Proof Packets</h1>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {proofs.length === 0 && <div className="glass-panel text-sm text-silver">No proofs yet.</div>}
        {proofs.map((p) => (
          <Link key={p.id} href={`/app/proofs/${p.id}`} className="glass-panel hover:border-cyan2">
            <span className="section-label">{p.status}</span>
            <div className="font-mono text-xs text-silver mt-2">{p.id}</div>
            {p.onchainVerdictOutcome && (
              <div className="mt-3">
                <div className="font-display text-2xl text-lime2">{p.onchainVerdictOutcome}</div>
              </div>
            )}
          </Link>
        ))}
      </div>
    </main>
  );
}
