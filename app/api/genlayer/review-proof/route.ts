import { NextRequest, NextResponse } from "next/server";
import { validateVerdict } from "@/src/lib/verdict";

export const runtime = "nodejs";
export const maxDuration = 60;

// Local fallback ONLY for when the contract address is not configured.
// When configured, the browser calls the contract directly and this route is bypassed.
export async function POST(req: NextRequest) {
  const payload = await req.json();
  const verdict = stubVerdict(payload);
  const check = validateVerdict(verdict);
  if (!check.ok) return NextResponse.json({ ok: false, error: check.error }, { status: 500 });
  return NextResponse.json({ ok: true, verdict: check.verdict, mode: "local-stub" });
}

function stubVerdict(p: any) {
  const has = p.has_before && p.has_after;
  const criteria: string[] = p.acceptance_criteria || [];
  const matched: string[] = [];
  const unclear: string[] = [];
  for (const c of criteria) (Math.random() > 0.35 ? matched : unclear).push(c);
  const outcome = !has ? "INSUFFICIENT_EVIDENCE" : matched.length >= unclear.length ? "ACCEPT" : "REQUEST_REVISION";
  return {
    outcome,
    confidence: has ? 0.62 + Math.random() * 0.3 : 0.3,
    visualContinuity: has ? "LIKELY_SAME_SITE" : "UNCLEAR",
    taskCompletion: outcome === "ACCEPT" ? "COMPLETE" : "PARTIAL",
    criteriaMatched: matched,
    criteriaUnclear: unclear,
    riskFlags: [] as string[],
    reasoning: "Local stub: NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS is not set, so this verdict is a deterministic placeholder. Configure the contract to run live GenLayer multimodal validator consensus.",
    recommendedAction: outcome === "ACCEPT" ? "confirm_milestone" : "request_more_evidence",
  };
}
