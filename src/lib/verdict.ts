import { z } from "zod";

export const OUTCOMES = ["VERIFIED", "VERIFIED_WITH_NOTES", "REVISION_REQUIRED", "INSUFFICIENT_EVIDENCE", "REJECTED", "ESCALATED", "UNDETERMINED"] as const;
export const CONTINUITY = ["LIKELY_SAME_SITE", "UNCLEAR", "LIKELY_DIFFERENT_SITE"] as const;
export const COMPLETION = ["COMPLETE", "PARTIAL", "NOT_SHOWN", "UNCLEAR"] as const;
export const ACTIONS = ["confirm_milestone", "keep_pending", "request_revision", "request_more_evidence", "escalate"] as const;

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
  VERIFIED: { label: "Evidence substantially satisfies task", color: "#B9FF2C", action: "confirm milestone" },
  VERIFIED_WITH_NOTES: { label: "Verified with minor observations noted", color: "#E0C050", action: "confirm milestone" },
  REVISION_REQUIRED: { label: "Work partly done — more evidence needed", color: "#FFB000", action: "request revision" },
  INSUFFICIENT_EVIDENCE: { label: "Cannot judge from submitted evidence", color: "#FFB000", action: "request more proof" },
  REJECTED: { label: "Evidence does not meet criteria", color: "#FF3D2E", action: "escalate" },
  ESCALATED: { label: "Requires human or regulated review", color: "#8B5CF6", action: "escalate" },
  UNDETERMINED: { label: "Genuinely impossible to judge", color: "#A0A0A0", action: "escalate" },
};
