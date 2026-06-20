"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getImage } from "@/src/lib/storage";
import { fetchContract, fetchProofsForContract } from "@/src/lib/genlayer/queries";
import { validateVerdict } from "@/src/lib/verdict";
import { VerdictLens } from "@/components/VerdictLens";
import { sha256Hex } from "@/src/lib/hash";
import { writeAndWait, read } from "@/src/lib/genlayer/client";
import { isContractConfigured, getGenlayerExplorerTxUrl } from "@/src/lib/genlayer/config";

function extractVerdictFromReceipt(receipt: any): any | null {
  if (!receipt) return null;
  // Walk the entire receipt tree. Any string that parses to a CertaFrame verdict wins.
  const stack: any[] = [receipt];
  const seen = new WeakSet<object>();
  while (stack.length) {
    const node = stack.pop();
    if (node == null) continue;
    if (typeof node === "string") {
      const parsed = tryParseVerdict(node);
      if (parsed) return parsed;
      continue;
    }
    if (typeof node === "object") {
      if (seen.has(node)) continue;
      seen.add(node);
      if ("outcome" in node && "recommendedAction" in node) {
        const parsed = tryParseVerdict(node);
        if (parsed) return parsed;
      }
      for (const v of Object.values(node)) stack.push(v);
    }
  }
  return null;
}

function tryParseVerdict(raw: any): any | null {
  if (!raw) return null;
  if (typeof raw === "object" && "outcome" in raw) return raw;
  if (typeof raw !== "string") return null;
  let s = raw.trim();
  // Strip GenVM "Return" prefix or quoted-JSON wrapping.
  if (s.startsWith('"') && s.endsWith('"')) {
    try { s = JSON.parse(s); } catch {}
  }
  try {
    const j = JSON.parse(s);
    if (typeof j === "object" && j && "outcome" in j) return j;
    if (typeof j === "string") return tryParseVerdict(j);
  } catch {}
  const start = s.indexOf("{"); const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      const j = JSON.parse(s.slice(start, end + 1));
      if ("outcome" in j) return j;
    } catch {}
  }
  return null;
}


export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null);
  const [proofs, setProofs] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [verdict, setVerdict] = useState<any>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContract(id).then(setC);
    fetchProofsForContract(id).then((ps) => { setProofs(ps); if (ps[0]) setSelected(ps[0].id); });
  }, [id]);

  async function runReview() {
    setError(""); setVerdict(null); setTxHash("");
    const proof = proofs.find((p) => p.id === selected);
    if (!proof) return;

    try {
    setBusy("Loading images…");
    const beforeHash = proof.imageHashBundle?.before || null;
    const afterHash = proof.imageHashBundle?.after || null;
    const beforeBlob = beforeHash ? await getImage(beforeHash) : null;
    const afterBlob = afterHash ? await getImage(afterHash) : null;
    const toB64 = async (b: Blob | null) => b ? await new Promise<string>((res) => {
      const r = new FileReader(); r.onloadend = () => res(r.result as string); r.readAsDataURL(b);
    }) : null;
    const beforeB64 = await toB64(beforeBlob);
    const afterB64 = await toB64(afterBlob);

    // envelope fields may be absent when proof was read from chain (not local cache).
    const submittedAt = proof.submittedAt || proof.envelope?.createdAt || "unknown";
    const claim = proof.envelope?.claim || "(no claim text — envelope not in local cache)";

    const beforeRef = beforeHash
      ? `sha256:${beforeHash} — before evidence submitted by worker ${proof.submitter} at ${submittedAt}`
      : "no before image submitted";
    const afterRef = afterHash
      ? `sha256:${afterHash} — after evidence submitted by worker ${proof.submitter} at ${submittedAt} with claim: ${claim}`
      : "no after image submitted";
    const metadataRef = proof.imageHashBundle?.metadata
      ? `sha256:${proof.imageHashBundle.metadata} — metadata captured at ${proof.metadata?.capturedAt || submittedAt}`
      : "no metadata hash";

    const reviewPayload = {
      proof_id: proof.id,
      contract_id: c.id,
      task_description: c.description,
      acceptance_criteria: c.acceptanceCriteria,
      strictness: c.strictness,
      claim,
      submitter: proof.submitter,
      created_at: submittedAt,
      before_image_reference: beforeRef,
      before_image_description: beforeRef,
      after_image_reference: afterRef,
      after_image_description: afterRef,
      metadata_reference: metadataRef,
      metadata_description: metadataRef,
      envelope_summary: { submitter: proof.submitter, claim, created_at: submittedAt },
      metadata_summary: proof.metadata || null,
      before_image_data_url: beforeB64,
      after_image_data_url: afterB64,
      has_before: Boolean(beforeB64),
      has_after: Boolean(afterB64),
    };
    const reviewPayloadHash = await sha256Hex(JSON.stringify(reviewPayload));
    const payloadForContract = { ...reviewPayload, review_payload_hash: reviewPayloadHash };
    const payloadJson = JSON.stringify(payloadForContract);

    if (!isContractConfigured()) {
      setBusy("Local stub review…");
      const res = await fetch("/api/genlayer/review-proof", {
        method: "POST", headers: { "content-type": "application/json" }, body: payloadJson,
      });
      const j = await res.json(); setBusy("");
      if (!j.ok) return setError(j.error || "Review failed");
      const v = validateVerdict(j.verdict);
      if (!v.ok) return setError("Invalid verdict: " + v.error);
      setVerdict(v.verdict);
      return;
    }

    setBusy("Submitting review on-chain (validators take ~30-90s)…");
    try {
      const w = await writeAndWait("review_visual_proof", [proof.id, payloadJson]);
      setTxHash(w.hash);

      // Try the stored review first (fastest, works when consensus finalized cleanly).
      let v: any = null;
      try {
        setBusy("Reading verdict from contract…");
        const raw = await read("get_review", [proof.id]);
        const review = typeof raw === "string" && raw ? JSON.parse(raw) : raw;
        if (review?.verdict?.outcome) {
          const check = validateVerdict(review.verdict);
          v = check.ok ? check.verdict : review.verdict; // accept even if schema check fails
        }
      } catch {}

      // Fallback: pull the leader's returned verdict straight from the tx receipt.
      // Works even when consensus came back UNDETERMINED — the leader's output is still there.
      if (!v) {
        setBusy("Reading verdict from leader receipt…");
        const fromReceipt = extractVerdictFromReceipt(w.receipt);
        if (fromReceipt?.outcome) {
          const check = validateVerdict(fromReceipt);
          v = check.ok ? check.verdict : fromReceipt; // accept even if schema check fails
        }
      }

      setBusy("");
      if (!v) return setError("No verdict could be extracted from the receipt. Tx may still be in consensus — try refreshing.");

      setVerdict(v);
    } catch (e: any) {
      setBusy("");
      setError("On-chain review failed: " + (e?.shortMessage || e?.message || String(e)));
    }
    } catch (e: any) {
      setBusy("");
      setError("Review preparation failed: " + (e?.shortMessage || e?.message || String(e)));
    }
  }

  if (!c) return <main className="max-w-5xl mx-auto px-6 py-16 text-silver">Loading…</main>;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <span className="section-label">Run Visual Review · {c.title}</span>
      <h1 className="font-display text-5xl text-optic">Validator Lens</h1>

      <div className="glass-panel">
        <span className="section-label">Select Proof Packet</span>
        {proofs.length === 0 ? <p className="text-silver text-sm mt-2">No proofs to review.</p> : (
          <div className="mt-2 space-y-2">
            {proofs.map((p) => (
              <label key={p.id} className="flex items-center gap-3 text-sm">
                <input type="radio" name="p" checked={selected === p.id} onChange={() => setSelected(p.id)} />
                <span className="font-mono text-xs text-silver">{p.id}</span>
                <span className="text-xs text-cyan2">{p.status}</span>
              </label>
            ))}
          </div>
        )}
        <button disabled={Boolean(busy) || !selected} onClick={runReview} className="btn-review mt-4">
          {busy || "Run Visual Review"}
        </button>
        {txHash && (
          <div className="mt-3 hash-strip">
            review tx:{" "}
            <a
              href={getGenlayerExplorerTxUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan2 underline"
            >
              {txHash}
            </a>
          </div>
        )}
        {error && <p className="mt-3 text-xs text-magma font-mono whitespace-pre-wrap">{error}</p>}
      </div>

      {verdict && (
        <>
          <VerdictLens
            verdict={verdict}
            proofHash={proofs.find((p) => p.id === selected)?.envelopeHash}
            txHash={txHash}
          />
          <Link href={`/app/proofs/${selected}`} className="btn-secondary inline-block">Open Proof Packet</Link>
        </>
      )}
    </main>
  );
}
