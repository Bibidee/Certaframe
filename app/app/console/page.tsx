"use client";
import { useEffect, useState } from "react";
import { listProofs, listContracts, getContract, getReview } from "@/src/lib/storage";
import { BeforeAfterFrame } from "@/components/BeforeAfterFrame";
import { GENLAYER_STUDIONET, CONTRACT_ADDRESS } from "@/src/lib/genlayer/config";

const SECTIONS = [
  "01 / Contract Terms", "02 / Proof Envelope", "03 / Image Hashes", "04 / Signed Submission",
  "05 / Visual Evidence Pair", "06 / Validator Lens", "07 / Consensus Verdict", "08 / Action Mapping",
];

export default function Page() {
  const [proofs, setProofs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [proof, setProof] = useState<any>(null);
  const [contract, setContract] = useState<any>(null);
  const [review, setReview] = useState<any>(null);

  useEffect(() => { listProofs().then((ps) => { setProofs(ps); if (ps[0]) setSelected(ps[0].id); }); }, []);
  useEffect(() => {
    if (!selected) return;
    const p = proofs.find((x) => x.id === selected); setProof(p);
    if (p) { getContract(p.contractId).then(setContract); getReview(p.id).then(setReview); }
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
            <div className="hash-strip">before: {proof.imageHashBundle.before || "—"}</div>
            <div className="hash-strip">after: {proof.imageHashBundle.after}</div>
            <div className="hash-strip">metadata: {proof.imageHashBundle.metadata}</div>
          </div>
        ) : "—")}
        {section === "Signed Submission" && (proof ? (
          <div className="space-y-1 text-xs">
            <div className="hash-strip">submitter: {proof.submitter}</div>
            <div className="hash-strip">sig: {proof.signature?.slice(0, 60)}…</div>
            <div className="hash-strip">envelope hash: {proof.envelopeHash}</div>
          </div>
        ) : "—")}
        {section === "Visual Evidence Pair" && (proof ? <BeforeAfterFrame beforeHash={proof.imageHashBundle.before} afterHash={proof.imageHashBundle.after} /> : "—")}
        {section === "Validator Lens" && (review ? (
          <div className="text-xs space-y-1">
            <div>outcome: <span className="text-lime2">{review.verdict.outcome}</span></div>
            <div>confidence: {(review.verdict.confidence*100).toFixed(0)}%</div>
            <div>continuity: {review.verdict.visualContinuity}</div>
            <div>completion: {review.verdict.taskCompletion}</div>
          </div>
        ) : "—")}
        {section === "Consensus Verdict" && (review ? (
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(review.verdict, null, 2)}</pre>
        ) : "—")}
        {section === "Action Mapping" && (review ? (
          <div className="text-sm">
            <div>recommended: <span className="text-cyan2">{review.verdict.recommendedAction}</span></div>
            <div className="text-xs text-silver mt-1">UI surfaces this in the Action Gate of the proof packet.</div>
          </div>
        ) : "—")}
      </div>
    </div>
  );
}
