"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { listContracts } from "@/src/lib/storage";

export default function Page() {
  const [contracts, setContracts] = useState<any[]>([]);
  useEffect(() => { listContracts().then(setContracts); }, []);
  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex justify-between items-end mb-8">
        <div>
          <span className="section-label">All Contracts</span>
          <h1 className="font-display text-5xl text-optic">Proof Capsules</h1>
        </div>
        <Link href="/app/contracts/new" className="btn-primary"><span className="lens-circle"/>New Contract</Link>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {contracts.length === 0 && <div className="glass-panel text-sm text-silver">No contracts yet.</div>}
        {contracts.map((c) => (
          <Link key={c.id} href={`/app/contracts/${c.id}`} className="glass-panel hover:border-cyan2">
            <span className="section-label">{c.status}</span>
            <h3 className="font-head text-lg text-optic mt-1">{c.title}</h3>
            <p className="text-xs text-silver mt-2 line-clamp-3">{c.description}</p>
            <div className="hash-strip mt-3">deadline: {c.deadline || "—"}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
