"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccount, useSignTypedData } from "wagmi";
import { putImage, putProof } from "@/src/lib/storage";
import { fetchContract } from "@/src/lib/genlayer/queries";
import { hashFile, sha256Hex } from "@/src/lib/hash";
import { EIP712_DOMAIN, EIP712_TYPES, buildEnvelope, ProofEnvelope } from "@/src/lib/envelope";
import { writeAndWait } from "@/src/lib/genlayer/client";
import { isContractConfigured } from "@/src/lib/genlayer/config";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address } = useAccount();
  const { signTypedDataAsync } = useSignTypedData();
  const [c, setC] = useState<any>(null);
  const [beforeFile, setBeforeFile] = useState<File | null>(null);
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [beforeHash, setBeforeHash] = useState<string>("");
  const [afterHash, setAfterHash] = useState<string>("");
  const [claim, setClaim] = useState<string>("Task completed as agreed.");
  const [note, setNote] = useState<string>("");
  const [busy, setBusy] = useState<string>("");

  useEffect(() => { fetchContract(id).then(setC); }, [id]);

  async function pick(side: "before" | "after", f: File | null) {
    if (!f) return;
    const h = await hashFile(f);
    await putImage(h, f);
    if (side === "before") { setBeforeFile(f); setBeforeHash(h); }
    else { setAfterFile(f); setAfterHash(h); }
  }

  async function submit() {
    if (!address) return alert("Connect wallet");
    if (!c) return;
    if (c.beforeRequired && !beforeHash) return alert("Before image required");
    if (c.afterRequired && !afterHash) return alert("After image required");

    setBusy("Hashing metadata…");
    const metadata = {
      contractId: c.id, claim, note,
      beforeMeta: beforeFile ? { name: beforeFile.name, size: beforeFile.size, type: beforeFile.type } : null,
      afterMeta: afterFile ? { name: afterFile.name, size: afterFile.size, type: afterFile.type } : null,
      capturedAt: new Date().toISOString(),
    };
    const metadataHash = await sha256Hex(JSON.stringify(metadata));

    const envelope: ProofEnvelope = buildEnvelope({
      contractId: c.id, taskId: c.id, submitter: address as `0x${string}`,
      beforeImageHash: beforeHash, afterImageHash: afterHash, metadataHash, claim,
    });

    setBusy("Awaiting signature…");
    let signature = "";
    try {
      signature = await signTypedDataAsync({
        domain: EIP712_DOMAIN, types: EIP712_TYPES, primaryType: "ProofEnvelope", message: envelope as any,
      });
    } catch (e: any) {
      setBusy(""); return alert("Signature rejected: " + (e?.message || e));
    }

    setBusy("Computing envelope hash…");
    const envelopeHash = await sha256Hex(JSON.stringify(envelope));
    const proofId = "p_" + crypto.randomUUID();
    const imageHashBundle = { before: beforeHash || null, after: afterHash, metadata: metadataHash };

    let txHash = ""; let explorerUrl = "";
    if (isContractConfigured()) {
      setBusy("Submitting on-chain commitment…");
      try {
        const res = await writeAndWait("submit_proof_commitment", [
          proofId, c.id, envelopeHash, JSON.stringify(imageHashBundle),
        ]);
        txHash = res.hash; explorerUrl = res.explorerUrl;
      } catch (e: any) {
        setBusy("");
        return alert("On-chain submit_proof_commitment failed: " + (e?.shortMessage || e?.message || e));
      }
    }

    const proof = {
      id: proofId, contractId: c.id, submitter: address,
      envelope, envelopeHash, signature, imageHashBundle, metadata,
      txHash, explorerUrl,
      status: "PROOF_SUBMITTED", createdAt: new Date().toISOString(),
    };
    await putProof(proof);
    router.push(`/app/proofs/${proofId}`);
  }

  if (!c) return <main className="max-w-5xl mx-auto px-6 py-16 text-silver">Loading…</main>;

  return (
    <main className="max-w-6xl mx-auto px-6 py-12">
      <span className="section-label">Submit Proof for {c.title}</span>
      <h1 className="font-display text-5xl text-optic mb-6">Evidence Split</h1>

      <div className="grid lg:grid-cols-3 gap-5">
        <Drop label="Before Frame" required={c.beforeRequired} file={beforeFile} hash={beforeHash} onPick={(f) => pick("before", f)} />
        <div className="glass-panel">
          <span className="section-label">Proof Envelope Seal</span>
          <label className="block mt-3"><span className="section-label">Claim</span>
            <textarea className="inp mt-1" rows={3} value={claim} onChange={(e) => setClaim(e.target.value)} />
          </label>
          <label className="block mt-3"><span className="section-label">Witness note (optional)</span>
            <textarea className="inp mt-1" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="mt-4 space-y-2">
            <div className="hash-strip">submitter: {address || "—"}</div>
            <div className="hash-strip">contract: {c.id.slice(0, 18)}…</div>
          </div>
          <button onClick={submit} disabled={Boolean(busy)} className="btn-seal w-full mt-5">
            {busy || "Sign & Seal Proof Packet"}
          </button>
        </div>
        <Drop label="After Frame" required={c.afterRequired} file={afterFile} hash={afterHash} onPick={(f) => pick("after", f)} />
      </div>

      <style jsx global>{`
        .inp { width:100%; background:#0b1418; border:1px solid rgba(0,194,255,0.25); color:#EAF9FF;
          padding:0.6rem 0.7rem; font-family: var(--font-mono); font-size:0.85rem; border-radius:2px; }
      `}</style>
    </main>
  );
}

function Drop({ label, required, file, hash, onPick }: { label: string; required: boolean; file: File | null; hash: string; onPick: (f: File | null) => void }) {
  return (
    <div className="glass-panel">
      <div className="flex justify-between">
        <span className="section-label">{label}</span>
        <span className="text-[10px] font-mono uppercase" style={{ color: required ? "var(--vermilion)" : "var(--silver)" }}>{required ? "REQUIRED" : "optional"}</span>
      </div>
      <label className="mt-3 block aspect-square border-2 border-dashed border-cyan2/30 flex items-center justify-center cursor-pointer overflow-hidden">
        {file ? <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" /> : <span className="text-silver text-xs font-mono">DROP / SELECT IMAGE</span>}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onPick(e.target.files?.[0] || null)} />
      </label>
      {hash && <div className="hash-strip mt-3">SHA-256: {hash}</div>}
    </div>
  );
}
