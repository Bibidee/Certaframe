"use client";
import { read } from "./client";
import { isContractConfigured } from "./config";

// Contract state is the source of truth.
// IndexedDB is allowed only for local image blobs and draft/form state.

function safeJson(raw: any) {
  if (raw == null || raw === "") return null;
  if (typeof raw === "object") return raw;
  try { return JSON.parse(typeof raw === "string" ? raw : String(raw)); }
  catch { return null; }
}

// ---------- Protocol stats ----------

export type ProtocolStats = {
  contracts: number; proofs: number; reviews: number; disputes: number;
  accept: number; revision: number; insufficient: number;
  mismatch: number; manipulation: number; escalate: number; keepers: number;
};

export async function fetchProtocolStats(): Promise<ProtocolStats | null> {
  if (!isContractConfigured()) return null;
  try {
    const raw = await read("get_protocol_stats", []);
    const parsed = safeJson(raw);
    if (parsed && typeof parsed === "object") return parsed as ProtocolStats;
  } catch (e) { console.warn("get_protocol_stats failed", e); }
  return null;
}

// ---------- User contracts ----------

export async function fetchUserContractIds(addr: string): Promise<string[]> {
  if (!isContractConfigured() || !addr) return [];
  try {
    const raw = await read("get_user_contracts", [addr.toLowerCase()]);
    const arr = safeJson(raw);
    if (Array.isArray(arr)) return arr;
  } catch (e) { console.warn("get_user_contracts failed", e); }
  return [];
}

// ---------- Contract record ----------

function normalizeContractRecord(onchain: any): any | null {
  if (!onchain || typeof onchain !== "object") return null;
  if (onchain.error) return null;
  const payload = safeJson(onchain.contract_json) || {};
  return {
    id: onchain.contract_id || payload.contract_id,
    client: onchain.client || payload.client,
    worker: onchain.worker || payload.worker,
    title: payload.title || "",
    locationLabel: payload.location_label || "",
    description: payload.description || "",
    acceptanceCriteria: payload.acceptance_criteria || [],
    beforeRequired: payload.before_required ?? true,
    afterRequired: payload.after_required ?? true,
    sameAngle: payload.same_angle ?? false,
    deadline: payload.deadline || "",
    strictness: payload.strictness || "normal",
    escalation: payload.escalation || "manual",
    paymentMode: payload.payment_mode || "",
    contractHash: onchain.contract_hash,
    status: onchain.status,
    latestProofId: onchain.latest_proof_id || "",
    latestReviewOutcome: onchain.latest_review_outcome || "",
    latestRecommendedAction: onchain.latest_recommended_action || "",
    createdAt: onchain.created_at || payload.created_at,
    createdBy: onchain.created_by,
  };
}

export async function fetchContract(id: string): Promise<any | null> {
  if (!isContractConfigured()) return null;
  try {
    const raw = await read("get_contract", [id]);
    const parsed = safeJson(raw);
    return parsed ? normalizeContractRecord(parsed) : null;
  } catch (e) { console.warn("get_contract failed", e); }
  return null;
}

// ---------- Proof ----------

function normalizeProofRecord(onchain: any): any | null {
  if (!onchain || typeof onchain !== "object") return null;
  if (onchain.error) return null;
  const bundle = safeJson(onchain.image_hash_bundle) || {};
  return {
    id: onchain.proof_id,
    contractId: onchain.contract_id,
    envelopeHash: onchain.proof_envelope_hash,
    imageHashBundle: {
      before: bundle.before ?? bundle.beforeImageHash ?? null,
      after: bundle.after ?? bundle.afterImageHash ?? null,
      metadata: bundle.metadata ?? bundle.metadataHash ?? null,
    },
    submitter: onchain.submitted_by,
    status: onchain.status,
    onchainVerdictOutcome: onchain.verdict_outcome || "",
    onchainVerdictAction: onchain.verdict_action || "",
    reviewCount: onchain.review_count ?? 0,
    disputeId: onchain.dispute_id || "",
    submittedAt: onchain.submitted_at,
  };
}

export async function fetchProof(id: string): Promise<any | null> {
  if (!isContractConfigured()) return null;
  try {
    const raw = await read("get_proof", [id]);
    const parsed = safeJson(raw);
    return parsed ? normalizeProofRecord(parsed) : null;
  } catch (e) { console.warn("get_proof failed", e); }
  return null;
}

// ---------- Review ----------

export async function fetchReview(proofId: string): Promise<any | null> {
  if (!isContractConfigured()) return null;
  try {
    const raw = await read("get_review", [proofId]);
    const parsed = safeJson(raw);
    if (parsed && !parsed.error) {
      return {
        proofId,
        verdict: parsed.verdict || parsed,
        reviewedAt: parsed.reviewed_at,
        reviewedBy: parsed.reviewed_by,
        txHash: parsed.txHash,
      };
    }
  } catch (e) { console.warn("get_review failed", e); }
  return null;
}

// ---------- Dispute ----------

export async function fetchDispute(disputeId: string): Promise<any | null> {
  if (!isContractConfigured() || !disputeId) return null;
  try {
    const raw = await read("get_dispute", [disputeId]);
    const parsed = safeJson(raw);
    if (parsed && !parsed.error) return parsed;
  } catch (e) { console.warn("get_dispute failed", e); }
  return null;
}

// ---------- Dispute resolution ----------

export async function fetchDisputeResolution(disputeId: string): Promise<any | null> {
  if (!isContractConfigured() || !disputeId) return null;
  try {
    const raw = await read("get_resolution", [disputeId]);
    const parsed = safeJson(raw);
    if (parsed && !parsed.error) return parsed;
  } catch (e) { console.warn("get_resolution failed", e); }
  return null;
}

// ---------- Bulk for dashboard ----------

export async function fetchUserContracts(addr: string): Promise<any[]> {
  const ids = await fetchUserContractIds(addr);
  if (ids.length === 0) return [];
  const results = await Promise.all(ids.map((id) => fetchContract(id)));
  return results.filter(Boolean);
}

export async function fetchProofsForContract(contractId: string): Promise<any[]> {
  if (!isContractConfigured()) return [];
  try {
    const raw = await read("get_contract_proofs", [contractId]);
    const ids = safeJson(raw);
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const results = await Promise.all(ids.map((id: string) => fetchProof(id)));
    return results.filter(Boolean);
  } catch (e) { console.warn("get_contract_proofs failed", e); }
  return [];
}

// ---------- Role helpers ----------

export async function isAdmin(addr: string): Promise<boolean> {
  if (!isContractConfigured() || !addr) return false;
  try {
    const raw = await read("get_admin", []);
    const a = (typeof raw === "string" ? raw : String(raw)).toLowerCase();
    return a === addr.toLowerCase();
  } catch (e) { return false; }
}

export async function isKeeper(addr: string): Promise<boolean> {
  if (!isContractConfigured() || !addr) return false;
  try {
    const raw = await read("is_keeper", [addr.toLowerCase()]);
    return Boolean(raw);
  } catch (e) { return false; }
}
