"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { getProof, getContract, getReview, putProof, putContract } from "@/src/lib/storage";
import { BeforeAfterFrame } from "@/components/BeforeAfterFrame";
import { VerdictLens } from "@/components/VerdictLens";
import { GENLAYER_STUDIONET, isContractConfigured } from "@/src/lib/genlayer/config";
import { writeAndWait } from "@/src/lib/genlayer/client";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const [p, setP] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [r, setR] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState<"UPHELD" | "REJECTED" | "REVIEW_AGAIN">("UPHELD");
  const [resolveNotes, setResolveNotes] = useState("");

  async function refresh() {
    const pr = await getProof(id); setP(pr);
    if (pr) { setC(await getContract(pr.contractId)); setR(await getReview(pr.id)); }
  }
  useEffect(() => { refresh(); }, [id]);

  const isClient = address && c?.client && address.toLowerCase() === c.client.toLowerCase();
  const isWorker = address && c?.worker && address.toLowerCase() === c.worker.toLowerCase();
  const isAccepted = p?.uiStatus === "MILESTONE_CONFIRMED" || c?.status === "ACCEPTED";
  const isDisputed = p?.status === "DISPUTED" || c?.status === "DISPUTED";
  const needsRevision = c?.status === "REVISION_REQUESTED" || p?.uiStatus === "REVISION_REQUESTED";

  async function confirmMilestone() {
    if (!isClient) return alert("Only the client wallet can confirm the milestone. Switch to the contract creator's wallet.");
    setBusy("Recording milestone confirmation…"); setMsg("");
    const stamp = new Date().toISOString();
    await putProof({ ...p, uiStatus: "MILESTONE_CONFIRMED", confirmedAt: stamp, confirmedBy: address });
    await putContract({ ...c, status: "ACCEPTED", confirmedAt: stamp });
    setBusy(""); setMsg("Milestone confirmed. Contract marked ACCEPTED locally — on-chain status already follows the verdict.");
    refresh();
  }

  async function submitRevision() {
    if (!isClient) return alert("Only the client wallet can request revision.");
    if (!revisionText.trim()) return;
    await putProof({ ...p, uiStatus: "REVISION_REQUESTED", revisionReason: revisionText.trim(), revisedAt: new Date().toISOString() });
    await putContract({ ...c, status: "REVISION_REQUESTED" });
    setRevisionOpen(false); setRevisionText("");
    setMsg("Revision requested. Worker can now submit a new proof packet.");
    refresh();
  }

  async function submitDispute() {
    if (!address) return alert("Connect wallet.");
    const isWorker = c?.worker && address.toLowerCase() === c.worker.toLowerCase();
    if (!isClient && !isWorker) return alert("Only the client or worker can open a dispute.");
    if (!disputeText.trim()) return;
    const reason = disputeText.trim();
    const disputeId = "d_" + crypto.randomUUID();
    const disputeJson = JSON.stringify({
      reason: reason.trim(),
      raised_by: address,
      raised_at: new Date().toISOString(),
      proof_id: p.id,
      contract_id: c.id,
    });
    setBusy("Recording dispute on-chain…"); setMsg("");
    try {
      const w = isContractConfigured()
        ? await writeAndWait("record_dispute", [p.id, disputeId, disputeJson])
        : { hash: "", explorerUrl: "" };
      await putProof({
        ...p, status: "DISPUTED", disputeId,
        disputeReason: reason, disputeRaisedBy: address, disputeRaisedAt: new Date().toISOString(),
        disputeTxHash: w.hash, disputeExplorerUrl: w.explorerUrl,
      });
      await putContract({ ...c, status: "DISPUTED" });
      setBusy(""); setDisputeOpen(false); setDisputeText("");
      setMsg(`Dispute recorded. Tx: ${w.hash || "(local only)"}`);
      refresh();
    } catch (e: any) {
      setBusy("");
      setMsg("Dispute failed: " + (e?.shortMessage || e?.message || String(e)));
    }
  }

  async function submitResolution() {
    if (!address) return alert("Connect wallet.");
    if (!isClient && !isWorker) return alert("Only the client or worker can resolve this dispute.");
    if (!resolveNotes.trim()) return;
    const stamp = new Date().toISOString();
    const resolution = {
      outcome: resolveOutcome,
      notes: resolveNotes.trim(),
      resolved_by: address,
      resolved_at: stamp,
    };
    const next: any = { ...p, disputeResolution: resolution };
    // Translate the resolution into local contract/proof status the UI can read.
    let nextContractStatus = c?.status;
    if (resolveOutcome === "UPHELD") {
      next.status = "SUPERSEDED";
      nextContractStatus = "REVISION_REQUESTED";
    } else if (resolveOutcome === "REJECTED") {
      next.status = "REVIEWED";
      next.uiStatus = "MILESTONE_CONFIRMED";
      next.confirmedAt = stamp;
      next.confirmedBy = address;
      nextContractStatus = "ACCEPTED";
    } else if (resolveOutcome === "REVIEW_AGAIN") {
      next.status = "PROOF_SUBMITTED";
      nextContractStatus = "PROOF_SUBMITTED";
    }
    await putProof(next);
    if (c) await putContract({ ...c, status: nextContractStatus, disputeResolvedAt: stamp });
    setResolveOpen(false); setResolveNotes("");
    setMsg(`Dispute marked RESOLVED (${resolveOutcome}). Local-only acknowledgement — on-chain dispute record stays as audit trail.`);
    refresh();
  }

  const isResolved = Boolean(p?.disputeResolution);

  if (!p) return <main className="max-w-5xl mx-auto px-6 py-16 text-silver">Loading proof…</main>;

  const canAct = Boolean(p.verdict);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <span className="section-label">Proof Packet</span>
      <h1 className="font-display text-5xl text-optic">{c?.title || "Contract"}</h1>

      <BeforeAfterFrame beforeHash={p.imageHashBundle.before} afterHash={p.imageHashBundle.after} />

      <div className="glass-panel">
        <span className="section-label">Seal Card</span>
        <div className="mt-2 space-y-1">
          <div className="hash-strip">proof id: {p.id}</div>
          <div className="hash-strip">envelope hash: {p.envelopeHash}</div>
          <div className="hash-strip">signature: {p.signature?.slice(0, 26)}…</div>
          <div className="hash-strip">submitter: {p.submitter}</div>
          <div className="hash-strip">claim: {p.envelope?.claim}</div>
          <div className="hash-strip">created: {p.createdAt}</div>
          {p.txHash && (
            <div className="hash-strip">
              submit tx: <a href={p.explorerUrl} target="_blank" className="text-cyan2">{p.txHash}</a>
            </div>
          )}
          {p.reviewTxHash && (
            <div className="hash-strip">
              review tx: <a href={`${GENLAYER_STUDIONET.explorerUrl}/tx/${p.reviewTxHash}`} target="_blank" className="text-cyan2">{p.reviewTxHash}</a>
            </div>
          )}
          {p.disputeTxHash && (
            <div className="hash-strip">
              dispute tx: <a href={p.disputeExplorerUrl} target="_blank" className="text-magma">{p.disputeTxHash}</a>
            </div>
          )}
        </div>
      </div>

      {isDisputed && (
        <div className="glass-panel border-magma/60">
          <span className="section-label" style={{ color: "var(--magma)" }}>Dispute Open</span>
          {p.disputeReason ? (
            <p className="text-sm text-bone mt-2 leading-relaxed whitespace-pre-wrap">
              <span className="font-mono text-xs text-silver">REASON:</span> {p.disputeReason}
            </p>
          ) : (
            <p className="text-xs text-silver mt-2">
              Dispute reason isn&apos;t stored in this browser. Open the dispute tx on the explorer for the full payload.
            </p>
          )}
          <div className="mt-2 space-y-1 text-xs">
            {p.disputeRaisedBy && <div className="hash-strip">raised by: {p.disputeRaisedBy}</div>}
            {p.disputeRaisedAt && <div className="hash-strip">raised at: {p.disputeRaisedAt}</div>}
            {p.disputeId && <div className="hash-strip">dispute id: {p.disputeId}</div>}
            {p.disputeTxHash && (
              <div className="hash-strip">
                dispute tx:{" "}
                <a href={p.disputeExplorerUrl} target="_blank" className="text-magma underline">
                  {p.disputeTxHash}
                </a>
              </div>
            )}
          </div>
          {isResolved ? (
            <div className="mt-3 border border-lime2/40 p-3 rounded-sm bg-lime2/5">
              <span className="section-label" style={{ color: "var(--lime2)" }}>
                Resolved · {p.disputeResolution.outcome}
              </span>
              <p className="text-sm text-bone mt-1 whitespace-pre-wrap">{p.disputeResolution.notes}</p>
              <div className="hash-strip mt-2">resolved by: {p.disputeResolution.resolved_by}</div>
              <div className="hash-strip mt-1">resolved at: {p.disputeResolution.resolved_at}</div>
              <p className="text-[10px] font-mono text-silver mt-2">
                Local-only acknowledgement. On-chain dispute record remains as the permanent audit trail.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-mono text-silver mt-3">
                Dispute recorded on Studionet. Either party can mark it resolved here once an outcome is agreed off-chain.
              </p>
              {(isClient || isWorker) && (
                <button
                  onClick={() => setResolveOpen(!resolveOpen)}
                  className="btn-secondary mt-3"
                >
                  {resolveOpen ? "Cancel" : "Mark Resolved"}
                </button>
              )}
              {resolveOpen && (
                <div className="mt-3 border border-cyan2/40 p-3 rounded-sm bg-lens/60">
                  <span className="section-label">Resolution outcome</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["UPHELD", "REJECTED", "REVIEW_AGAIN"] as const).map((o) => (
                      <button key={o} type="button" onClick={() => setResolveOutcome(o)}
                        className={`p-2 text-[10px] font-mono uppercase border ${resolveOutcome === o ? "border-lime2 text-lime2 bg-lime2/10" : "border-silver/30 text-silver"}`}>
                        {o.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-silver mt-2 font-mono">
                    UPHELD = worker resubmits · REJECTED = milestone accepted · REVIEW_AGAIN = rerun review
                  </p>
                  <textarea
                    className="w-full mt-3 bg-[#0b1418] border border-cyan2/25 text-optic font-mono text-xs p-2 rounded-sm"
                    rows={3}
                    placeholder="Resolution notes (what was decided and why)"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                  />
                  <button onClick={submitResolution} disabled={!resolveNotes.trim()} className="btn-seal mt-2 disabled:opacity-40">
                    Record Resolution
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {needsRevision && isWorker && c?.id && (
        <div className="glass-panel border-amber2/50">
          <span className="section-label" style={{ color: "var(--amber2)" }}>Revision Requested</span>
          {p?.revisionReason && (
            <p className="text-sm text-bone mt-2 leading-relaxed whitespace-pre-wrap">
              <span className="font-mono text-xs text-silver">CLIENT NOTE:</span> {p.revisionReason}
            </p>
          )}
          <p className="text-xs text-silver mt-2">
            Submit a fresh proof packet that addresses the revision. The current proof will be marked SUPERSEDED on-chain.
          </p>
          <Link href={`/app/contracts/${c.id}/submit`} className="btn-seal mt-3 inline-block">Submit New Proof</Link>
        </div>
      )}

      {p.verdict ? (
        <VerdictLens
          verdict={p.verdict}
          proofHash={p.envelopeHash}
          txHash={r?.txHash || p.reviewTxHash}
          explorerUrl={(r?.txHash || p.reviewTxHash) ? `${GENLAYER_STUDIONET.explorerUrl}/tx/${r?.txHash || p.reviewTxHash}` : undefined}
        />
      ) : (
        <div className="glass-panel">
          <p className="text-silver text-sm">No verdict yet.</p>
          {c && <Link href={`/app/contracts/${c.id}/review`} className="btn-review mt-3 inline-block">Run Visual Review</Link>}
        </div>
      )}

      <div className="glass-panel">
        <span className="section-label">Action Gate</span>
        {!canAct && <p className="text-silver text-xs mt-2">Run a visual review first to unlock actions.</p>}
        {canAct && (
          <>
            <p className="text-xs text-silver mt-2">
              {isClient ? "You are the client — confirm or request revision below." :
                p.submitter?.toLowerCase() === address?.toLowerCase() ? "You are the worker — only the client can confirm or request revision. Either party can dispute." :
                  "Connect the client wallet to confirm or request revision."}
            </p>
            <div className="flex gap-3 mt-3 flex-wrap">
              <button onClick={confirmMilestone} disabled={!isClient || Boolean(busy) || isAccepted} className="btn-seal disabled:opacity-40">
                {isAccepted ? "Milestone Confirmed ✓" : busy || "Confirm Milestone"}
              </button>
              <button onClick={() => { setRevisionOpen(true); setDisputeOpen(false); }} disabled={!isClient || Boolean(busy)} className="btn-secondary disabled:opacity-40">
                Request Revision
              </button>
              <button onClick={() => { setDisputeOpen(true); setRevisionOpen(false); }} disabled={Boolean(busy) || isDisputed} className="btn-danger disabled:opacity-40">
                {isDisputed ? "Disputed" : "Open Dispute"}
              </button>
            </div>

            {revisionOpen && (
              <div className="mt-4 border border-cyan2/40 p-4 rounded-sm bg-lens/60">
                <span className="section-label">What needs revision?</span>
                <textarea
                  className="w-full mt-2 bg-[#0b1418] border border-cyan2/25 text-optic font-mono text-xs p-2 rounded-sm"
                  rows={3}
                  placeholder="e.g. After image is too dark — retake in daylight with the full wall in frame."
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={submitRevision} disabled={!revisionText.trim()} className="btn-secondary disabled:opacity-40">Send to Worker</button>
                  <button onClick={() => { setRevisionOpen(false); setRevisionText(""); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {disputeOpen && (
              <div className="mt-4 border border-magma/50 p-4 rounded-sm bg-lens/60">
                <span className="section-label" style={{ color: "var(--magma)" }}>Reason for dispute (required)</span>
                <textarea
                  className="w-full mt-2 bg-[#0b1418] border border-magma/30 text-optic font-mono text-xs p-2 rounded-sm"
                  rows={3}
                  placeholder="Describe what's wrong and what you'd like reviewed. This is recorded on-chain."
                  value={disputeText}
                  onChange={(e) => setDisputeText(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={submitDispute} disabled={!disputeText.trim() || Boolean(busy)} className="btn-danger disabled:opacity-40">
                    {busy || "Record Dispute On-Chain"}
                  </button>
                  <button onClick={() => { setDisputeOpen(false); setDisputeText(""); }} className="btn-secondary">Cancel</button>
                </div>
              </div>
            )}

            {msg && <p className="text-xs mt-3 font-mono text-cyan2 whitespace-pre-wrap">{msg}</p>}
          </>
        )}
      </div>
    </main>
  );
}
