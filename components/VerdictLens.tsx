import { OUTCOME_META } from "@/src/lib/verdict";
import { getGenlayerExplorerTxUrl } from "@/src/lib/genlayer/config";

export function VerdictLens({ verdict, proofHash, txHash }: {
  verdict: Record<string, any>; proofHash?: string; txHash?: string;
}) {
  const meta = OUTCOME_META[verdict.outcome] || OUTCOME_META.UNDETERMINED;
  const explorerUrl = txHash ? getGenlayerExplorerTxUrl(txHash) : undefined;
  return (
    <div className="glass-panel">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="section-label">Verdict Lens</span>
          <h2 className="font-display text-4xl mt-1" style={{ color: meta.color }}>{verdict.outcome}</h2>
          <p className="text-sm text-silver mt-1">{meta.label}</p>
        </div>
        <div className="text-right">
          <span className="section-label">Confidence</span>
          <p className="font-mono text-3xl text-optic">{(verdict.confidence * 100).toFixed(0)}%</p>
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        <Stat label="Visual Continuity" value={verdict.visualContinuity} />
        <Stat label="Task Completion" value={verdict.taskCompletion} />
        <Stat label="Recommended Action" value={verdict.recommendedAction} />
      </div>
      <CriteriaList title="Criteria Matched" items={verdict.criteriaMatched} color="var(--lime2)" />
      <CriteriaList title="Criteria Unclear" items={verdict.criteriaUnclear} color="var(--amber2)" />
      {verdict.riskFlags.length > 0 && (
        <div className="mb-4">
          <span className="section-label">Risk Flags</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {verdict.riskFlags.map((r: string) => <span key={r} className="crack-mark">{r}</span>)}
          </div>
        </div>
      )}
      <div className="mb-4">
        <span className="section-label">Reasoning</span>
        <p className="mt-1 text-sm text-optic leading-relaxed">{verdict.reasoning}</p>
      </div>
      <div className="grid md:grid-cols-3 gap-2 text-[10px]">
        {proofHash && <div className="hash-strip">proof: {proofHash}</div>}
        {txHash && <div className="hash-strip">tx: {txHash}</div>}
        {explorerUrl && <a className="hash-strip text-cyan2" href={explorerUrl} target="_blank">explorer ↗</a>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-cyan2/20 p-3 rounded-sm">
      <span className="section-label">{label}</span>
      <p className="font-mono text-sm text-optic mt-1">{value}</p>
    </div>
  );
}

function CriteriaList({ title, items, color }: { title: string; items: string[]; color: string }) {
  if (!items.length) return null;
  return (
    <div className="mb-4">
      <span className="section-label">{title}</span>
      <ul className="mt-2 space-y-1">
        {items.map((c, i) => (
          <li key={i} className="text-sm text-optic flex gap-2">
            <span style={{ color }}>▸</span>{c}
          </li>
        ))}
      </ul>
    </div>
  );
}
