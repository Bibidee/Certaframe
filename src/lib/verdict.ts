import { z } from "zod";

export const OUTCOMES = ["ACCEPT", "REQUEST_REVISION", "INSUFFICIENT_EVIDENCE", "POSSIBLE_MISMATCH", "POSSIBLE_MANIPULATION", "ESCALATE_TO_HUMAN"] as const;
export const CONTINUITY = ["LIKELY_SAME_SITE", "UNCLEAR", "LIKELY_DIFFERENT_SITE"] as const;
export const COMPLETION = ["COMPLETE", "PARTIAL", "NOT_SHOWN", "UNCLEAR"] as const;
export const ACTIONS = ["confirm_milestone", "keep_pending", "request_more_evidence", "escalate"] as const;

export const VerdictSchema = z.object({
  outcome: z.enum(OUTCOMES),
  confidence: z.number().min(0).max(1),
  visualContinuity: z.enum(CONTINUITY),
  taskCompletion: z.enum(COMPLETION),
  criteriaMatched: z.array(z.string()),
  criteriaUnclear: z.array(z.string()),
  riskFlags: z.array(z.string()),
  reasoning: z.string().min(1),
  recommendedAction: z.enum(ACTIONS),
});
export type Verdict = z.infer<typeof VerdictSchema>;

export function validateVerdict(raw: unknown): { ok: true; verdict: Verdict } | { ok: false; error: string } {
  const r = VerdictSchema.safeParse(raw);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") };
  return { ok: true, verdict: r.data };
}

export const OUTCOME_META: Record<string, { label: string; color: string; action: string }> = {
  ACCEPT: { label: "Evidence likely satisfies task", color: "#B9FF2C", action: "confirm milestone" },
  REQUEST_REVISION: { label: "Work partly done or image unclear", color: "#FFB000", action: "ask worker to resubmit" },
  INSUFFICIENT_EVIDENCE: { label: "Cannot judge from evidence", color: "#FFB000", action: "request more proof" },
  POSSIBLE_MISMATCH: { label: "Images may not show same site", color: "#FF3D2E", action: "open dispute" },
  POSSIBLE_MANIPULATION: { label: "Manipulation/staging concern", color: "#D93600", action: "escalate" },
  ESCALATE_TO_HUMAN: { label: "Too much ambiguity", color: "#8B5CF6", action: "manual review" },
};
