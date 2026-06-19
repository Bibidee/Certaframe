"use client";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { BeforeAfterFrame } from "@/components/BeforeAfterFrame";
import { GENLAYER_STUDIONET, CONTRACT_ADDRESS } from "@/src/lib/genlayer/config";
import { fetchUserContracts, fetchProofsForContract, fetchContract, fetchReview } from "@/src/lib/genlayer/queries";

const SECTIONS = [
  "01 / Contract Terms", "02 / Proof Envelope", "03 / Image Hashes", "04 / Signed Submission",
  "05 / Visual Evidence Pair", "06 / Validator Lens", "07 / Consensus Verdict", "08 / Action Mapping",
];

export default function Page() {
  const { address } = useAccount();
  const [proofs, setProofs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [proof, setProof] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [review, setReview] = useState<any>(null);

  useEffect(() => {
    if (!address) return;
    fetchUserContracts(address).then(async (contracts) => {
      const nested = await Promise.all(contracts.map((c: any) => fetchProofsForContract(c.id)));
      const all = nested.flat();
      setProofs(all);
      if (all[0]) setSelected(all[0].id);
    });
  }, [address]);

  useEffect(() => {
    if (!selected) return;
    const p = proofs.find((x) => x.id === selected);
    setProof(p);
    if (p) {
      fetchContract(p.contractId).then(setContract);
      fetchReview(p.id).then(setReview);
    }
  }, [selected, proofs]);

  return (
    <main className="max-w-7xl mx-auto px-6 py-12">
      <span className="section-label">GenLayer Evidence Console</span>
      <h1 className="font-display text-5xl text-optic mb-2">Validator Trace</h1>
      <p className="text-silver text-sm mb-6">
        Contract: <span className="font-mono text-cyan2">{CONTRACT_ADDRESS || "(not configured)"}</span> · Chain {GENLAYER_STUDIONET.chainId}
      </p>

      <div className="glass-panel mb-6">
        <span className="section-label">Proof Packet</span>
        <select className="inp mt-2" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {proofs.length === 0 && <option>No proofs yet</option>}
          {proofs.map((p) => <option key={p.id} value={p.id}>{p.id}</option>)}
        </select>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {SECTIONS.map((s) => <Cell key={s} title={s} proof={proof} contract={contract} review={review} />)}
      </div>

      <style jsx global>{`
        .inp { width:100%; background:#0b1418; border:1px solid rgba(0,194,255,0.25); color:#EAF9FF;
          padding:0.6rem 0.7rem; font-family: var(--font-mono); font-size:0.85rem; border-radius:2px; }
      `}</style>
    </main>
  );
}

function Cell({ title, proof, contract, review }: any) {
  const section = title.split(" / ")[1];
  return (
    <div className="glass-panel">
      <span className="section-label">{title}</span>
      <div className="mt-3 text-sm text-optic font-mono">
        {section === "Contract Terms" && (contract ? (
          <div><div className="text-bone">{contract.title}</div><div className="text-xs text-silver mt-1">{contract.description}</div></div>
        ) : "—")}
        {section === "Proof Envelope" && (proof ? <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(proof.envelope, null, 2)}</pre> : "—")}
        {section === "Image Hashes" && (proof ? (
          <div className="space-y-1 text-xs">
            <div className="hash-strip">before: {proof.imageHashBundle?.before || "—"}</div>
            <div className="hash-strip">after: {proof.imageHashBundle?.after || "—"}</div>
            <div className="hash-strip">metadata: {proof.imageHashBundle?.metadata || "—"}</div>
          </div>
        ) : "—")}
        {section === "Signed Submission" && (proof ? (
          <div className="space-y-1 text-xs">
            <div className="hash-strip">submitter: {proof.submitter}</div>
            {proof.signature && <div className="hash-strip">sig: {proof.signature?.slice(0, 60)}…</div>}
            <div className="hash-strip">envelope hash: {proof.envelopeHash}</div>
          </div>
        ) : "—")}
        {section === "Visual Evidence Pair" && (proof ? <BeforeAfterFrame beforeHash={proof.imageHashBundle?.before} afterHash={proof.imageHashBundle?.after} /> : "—")}
        {section === "Validator Lens" && (review?.verdict ? (
          <div className="text-xs space-y-1">
            <div>outcome: <span className="text-lime2">{review.verdict.outcome}</span></div>
            <div>confidence: {(review.verdict.confidence*100).toFixed(0)}%</div>
            <div>continuity: {review.verdict.visualContinuity}</div>
            <div>completion: {review.verdict.taskCompletion}</div>
          </div>
        ) : "—")}
        {section === "Consensus Verdict" && (review?.verdict ? (
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(review.verdict, null, 2)}</pre>
        ) : "—")}
        {section === "Action Mapping" && (review?.verdict ? (
          <div className="text-sm">
            <div>recommended: <span className="text-cyan2">{review.verdict.recommendedAction}</span></div>
            <div className="text-xs text-silver mt-1">UI surfaces this in the Action Gate of the proof packet.</div>
          </div>
        ) : "—")}
      </div>
    </div>
  );
}
