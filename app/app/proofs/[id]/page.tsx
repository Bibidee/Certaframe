"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { fetchProof, fetchContract, fetchReview, fetchDispute, fetchDisputeResolution, isKeeper, isAdmin } from "@/src/lib/genlayer/queries";
import { BeforeAfterFrame } from "@/components/BeforeAfterFrame";
import { VerdictLens } from "@/components/VerdictLens";
import { GENLAYER_STUDIONET, isContractConfigured } from "@/src/lib/genlayer/config";
import { writeAndWait } from "@/src/lib/genlayer/client";

function extractResolutionFromReceipt(receipt: any): any | null {
  if (!receipt) return null;
  const stack: any[] = [receipt];
  const seen = new WeakSet<object>();
  while (stack.length) {
    const node = stack.pop();
    if (node == null) continue;
    if (typeof node === "string") {
      try {
        const j = JSON.parse(node);
        if (typeof j === "object" && j && "outcome" in j && "criteria_result" in j) return j;
        if (typeof j === "string") {
          const j2 = JSON.parse(j);
          if (typeof j2 === "object" && j2 && "outcome" in j2 && "criteria_result" in j2) return j2;
        }
      } catch {}
      continue;
    }
    if (typeof node === "object") {
      if (seen.has(node)) continue;
      seen.add(node);
      if ("outcome" in node && "criteria_result" in node) return node;
      if ("resolution" in node && typeof node.resolution === "object" && node.resolution && "outcome" in node.resolution) return node.resolution;
      for (const v of Object.values(node)) stack.push(v);
    }
  }
  return null;
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const { address } = useAccount();
  const [p, setP] = useState<any>(null);
  const [c, setC] = useState<any>(null);
  const [r, setR] = useState<any>(null);
  const [onchainDispute, setOnchainDispute] = useState<any>(null);
  const [onchainResolution, setOnchainResolution] = useState<any>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeText, setDisputeText] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState<"UPHELD" | "REJECTED" | "REVIEW_AGAIN">("UPHELD");
  const [resolveNotes, setResolveNotes] = useState("");

  const [role, setRole] = useState<{ admin: boolean; keeper: boolean }>({ admin: false, keeper: false });

  async function refresh() {
    const pr = await fetchProof(id);
    setP(pr);
    if (pr) {
      const [cc, rr] = await Promise.all([fetchContract(pr.contractId), fetchReview(pr.id)]);
      setC(cc);
      setR(rr);

      // Fetch dispute and resolution from chain — these are the source of truth.
      if (pr.disputeId) {
        const [dispute, resolution] = await Promise.all([
          fetchDispute(pr.disputeId),
          fetchDisputeResolution(pr.disputeId),
        ]);
        setOnchainDispute(dispute);
        setOnchainResolution(resolution);
      } else {
        setOnchainDispute(null);
        setOnchainResolution(null);
      }
    }
    if (address) {
      const [a, k] = await Promise.all([isAdmin(address), isKeeper(address)]);
      setRole({ admin: a, keeper: k });
    }
  }
  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id, address]);

  const isClient = address && c?.client && address.toLowerCase() === c.client.toLowerCase();
  const isWorker = address && c?.worker && address.toLowerCase() === c.worker.toLowerCase();
  const isPrivileged = role.admin || role.keeper;
  // On-chain state is authoritative for these flags.
  const isAccepted = c?.status === "ACCEPTED";
  const isDisputed = p?.status === "DISPUTED" || c?.status === "DISPUTED" || onchainDispute?.status === "OPEN" || onchainDispute?.status === "RESOLVED";
  const isResolved = onchainDispute?.status === "RESOLVED" || onchainResolution != null;
  const needsRevision = c?.status === "REVISION_REQUESTED";

  async function confirmMilestone() {
    if (!isClient && !isPrivileged) return alert("Only the client (or admin/keeper) can confirm the milestone.");
    setBusy("Refreshing on-chain status…"); setMsg("");
    await refresh();
    setBusy(""); setMsg("Milestone status synced from chain.");
  }

  async function submitRevision() {
    if (!isClient && !isPrivileged) return alert("Only the client (or admin/keeper) can request revision.");
    if (!revisionText.trim()) return;
    setRevisionOpen(false); setRevisionText("");
    setMsg("Revision noted. Contract status is set by the review verdict on-chain — worker can resubmit.");
    await refresh();
  }

  async function submitDispute() {
    if (!address) return alert("Connect wallet.");
    const isWorkerCheck = c?.worker && address.toLowerCase() === c.worker.toLowerCase();
    if (!isClient && !isWorkerCheck) return alert("Only the client or worker can open a dispute.");
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
      setBusy(""); setDisputeOpen(false); setDisputeText("");
      setMsg(`Dispute recorded on-chain. Tx: ${w.hash || "(local only)"}`);
      refresh();
    } catch (e: any) {
      setBusy("");
      setMsg("Dispute failed: " + (e?.shortMessage || e?.message || String(e)));
    }
  }

  async function submitResolution() {
    if (!address) return alert("Connect wallet.");
    const isWorkerCheck = c?.worker && address.toLowerCase() === c.worker.toLowerCase();
    if (!isClient && !isWorkerCheck && !isPrivileged) return alert("Only the client or worker can resolve this dispute.");
    if (!resolveNotes.trim()) return;

    const disputeId = p?.disputeId;
    if (!disputeId) return setMsg("No dispute ID found on proof record. Cannot resolve.");

    // context_notes carries the party's stated position. GenLayer adjudicates the actual outcome.
    const contextNotes = `Requested remedy: ${resolveOutcome}. Notes: ${resolveNotes.trim()}`;

    setBusy("Submitting dispute for on-chain adjudication (GenLayer validators ~30-90s)…"); setMsg("");
    try {
      const w = await writeAndWait("resolve_dispute", [disputeId, contextNotes]);
      setMsg(`Adjudication tx: ${w.hash}`);

      // Try reading the resolution back from contract state.
      setBusy("Reading resolution from contract…");
      let resolution = null;
      try { resolution = await fetchDisputeResolution(disputeId); } catch {}

      // Fall back to leader receipt tree-walk (handles UNDETERMINED consensus).
      if (!resolution && w.receipt) {
        setBusy("Reading resolution from leader receipt…");
        const fromReceipt = extractResolutionFromReceipt(w.receipt);
        if (fromReceipt) resolution = fromReceipt;
      }

      setBusy(""); setResolveOpen(false); setResolveNotes("");
      const outcome = resolution?.outcome || resolution?.resolution?.outcome;
      setMsg(
        outcome
          ? `Dispute resolved on-chain. GenLayer outcome: ${outcome}`
          : `Adjudication submitted. Tx: ${w.hash}. Refresh to see resolution.`
      );
      refresh();
    } catch (e: any) {
      setBusy("");
      setMsg("On-chain resolution failed: " + (e?.shortMessage || e?.message || String(e)));
    }
  }

  if (!p) return <main className="max-w-5xl mx-auto px-6 py-16 text-silver">Loading proof…</main>;

  const canAct = Boolean(p.verdict || p.onchainVerdictOutcome);
  const resolution = onchainResolution?.resolution;

  return (
    <main className="max-w-5xl mx-auto px-6 py-12 space-y-6">
      <span className="section-label">Proof Packet</span>
      <h1 className="font-display text-5xl text-optic">{c?.title || "Contract"}</h1>

      <BeforeAfterFrame beforeHash={p.imageHashBundle?.before} afterHash={p.imageHashBundle?.after} />

      <div className="glass-panel">
        <span className="section-label">Seal Card</span>
        <div className="mt-2 space-y-1">
          <div className="hash-strip">proof id: {p.id}</div>
          <div className="hash-strip">envelope hash: {p.envelopeHash}</div>
          {p.signature && <div className="hash-strip">signature: {p.signature?.slice(0, 26)}…</div>}
          <div className="hash-strip">submitter: {p.submitter}</div>
          {p.envelope?.claim && <div className="hash-strip">claim: {p.envelope?.claim}</div>}
          {p.submittedAt && <div className="hash-strip">submitted: {p.submittedAt}</div>}
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
          {onchainDispute ? (
            <p className="text-sm text-bone mt-2 leading-relaxed whitespace-pre-wrap">
              <span className="font-mono text-xs text-silver">REASON:</span>{" "}
              {(() => {
                try { return JSON.parse(onchainDispute.dispute_json)?.reason; } catch { return "—"; }
              })()}
            </p>
          ) : p.disputeReason ? (
            <p className="text-sm text-bone mt-2 leading-relaxed whitespace-pre-wrap">
              <span className="font-mono text-xs text-silver">REASON:</span> {p.disputeReason}
            </p>
          ) : (
            <p className="text-xs text-silver mt-2">
              Dispute reason on-chain — open the dispute tx on the explorer for the full payload.
            </p>
          )}
          <div className="mt-2 space-y-1 text-xs">
            {onchainDispute?.raised_by && <div className="hash-strip">raised by: {onchainDispute.raised_by}</div>}
            {onchainDispute?.raised_at && <div className="hash-strip">raised at: {onchainDispute.raised_at}</div>}
            {onchainDispute?.dispute_id && <div className="hash-strip">dispute id: {onchainDispute.dispute_id}</div>}
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
                Resolved on-chain · {resolution?.outcome || "—"}
              </span>
              {resolution?.reason && (
                <p className="text-sm text-bone mt-1 whitespace-pre-wrap">{resolution.reason}</p>
              )}
              {resolution && (
                <div className="mt-2 space-y-1 text-xs font-mono">
                  <div className="hash-strip">confidence: {resolution.confidence}</div>
                  <div className="hash-strip">criteria: {resolution.criteria_result}</div>
                  <div className="hash-strip">next action: {resolution.required_next_action}</div>
                  <div className="hash-strip">evidence integrity: {resolution.evidence_integrity}</div>
                </div>
              )}
              {onchainResolution?.resolved_by && (
                <div className="hash-strip mt-2">resolved by: {onchainResolution.resolved_by}</div>
              )}
              {onchainResolution?.resolved_at && (
                <div className="hash-strip mt-1">resolved at: {onchainResolution.resolved_at}</div>
              )}
              <p className="text-[10px] font-mono text-silver mt-2">
                Resolution stored on Studionet by GenLayer validators. Survives browser refresh and IndexedDB deletion.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] font-mono text-silver mt-3">
                Dispute recorded on Studionet. Either party can request GenLayer on-chain adjudication.
              </p>
              {(isClient || isWorker || isPrivileged) && (
                <button
                  onClick={() => setResolveOpen(!resolveOpen)}
                  className="btn-secondary mt-3"
                >
                  {resolveOpen ? "Cancel" : "Mark Resolved"}
                </button>
              )}
              {resolveOpen && (
                <div className="mt-3 border border-cyan2/40 p-3 rounded-sm bg-lens/60">
                  <span className="section-label">Your requested outcome (GenLayer adjudicates)</span>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["UPHELD", "REJECTED", "REVIEW_AGAIN"] as const).map((o) => (
                      <button key={o} type="button" onClick={() => setResolveOutcome(o)}
                        className={`p-2 text-[10px] font-mono uppercase border ${resolveOutcome === o ? "border-lime2 text-lime2 bg-lime2/10" : "border-silver/30 text-silver"}`}>
                        {o.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-silver mt-2 font-mono">
                    UPHELD = you believe worker should resubmit · REJECTED = you believe proof is valid · REVIEW_AGAIN = rerun review
                  </p>
                  <textarea
                    className="w-full mt-3 bg-[#0b1418] border border-cyan2/25 text-optic font-mono text-xs p-2 rounded-sm"
                    rows={3}
                    placeholder="Your position and supporting context (GenLayer validators make the final call)"
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                  />
                  <button onClick={submitResolution} disabled={!resolveNotes.trim() || Boolean(busy)} className="btn-seal mt-2 disabled:opacity-40">
                    {busy || "Adjudicate On-Chain"}
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
          <p className="text-xs text-silver mt-2">
            Submit a fresh proof packet that addresses the revision. The current proof will be marked SUPERSEDED on-chain.
          </p>
          <Link href={`/app/contracts/${c.id}/submit`} className="btn-seal mt-3 inline-block">Submit New Proof</Link>
        </div>
      )}

      {(p.verdict || p.onchainVerdictOutcome) ? (
        <VerdictLens
          verdict={p.verdict || { outcome: p.onchainVerdictOutcome, recommendedAction: p.onchainVerdictAction }}
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
                role.admin ? "You are the contract admin — full action gate." :
                role.keeper ? "You are a keeper — full action gate." :
                isWorker ? "You are the worker — only the client / admin / keeper can confirm or request revision. Either party can dispute." :
                  "Connect the client / admin / keeper wallet to confirm or request revision."}
            </p>
            <div className="flex gap-3 mt-3 flex-wrap">
              <button onClick={confirmMilestone} disabled={(!isClient && !isPrivileged) || Boolean(busy) || isAccepted} className="btn-seal disabled:opacity-40">
                {isAccepted ? "Milestone Confirmed ✓" : busy || "Confirm Milestone"}
              </button>
              <button onClick={() => { setRevisionOpen(true); setDisputeOpen(false); }} disabled={(!isClient && !isPrivileged) || Boolean(busy)} className="btn-secondary disabled:opacity-40">
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
