"use client";
import { read } from "./client";
import { isContractConfigured } from "./config";
import {
  getContract as cacheGetContract, putContract as cachePutContract,
  getProof as cacheGetProof, putProof as cachePutProof,
  getReview as cacheGetReview, putReview as cachePutReview,
  listContracts as cacheListContracts, listProofs as cacheListProofs,
} from "@/src/lib/storage";

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
  const cached = await cacheGetContract(id);
  if (!isContractConfigured()) return cached || null;
  try {
    const raw = await read("get_contract", [id]);
    const parsed = safeJson(raw);
    const merged = parsed ? normalizeContractRecord(parsed) : null;
    if (merged) {
      const combined = { ...(cached || {}), ...merged };
      await cachePutContract(combined);
      return combined;
    }
  } catch (e) { console.warn("get_contract failed", e); }
  return cached || null;
}

// ---------- Proof + review ----------

function normalizeProofRecord(onchain: any, cached: any): any | null {
  if (!onchain || typeof onchain !== "object") return null;
  const bundle = safeJson(onchain.image_hash_bundle) || cached?.imageHashBundle || {};
  return {
    ...(cached || {}),
    id: onchain.proof_id || cached?.id,
    contractId: onchain.contract_id || cached?.contractId,
    envelopeHash: onchain.proof_envelope_hash || cached?.envelopeHash,
    imageHashBundle: {
      before: bundle.before ?? bundle.beforeImageHash ?? cached?.imageHashBundle?.before ?? null,
      after: bundle.after ?? bundle.afterImageHash ?? cached?.imageHashBundle?.after ?? null,
      metadata: bundle.metadata ?? bundle.metadataHash ?? cached?.imageHashBundle?.metadata ?? null,
    },
    submitter: onchain.submitted_by || cached?.submitter,
    status: onchain.status || cached?.status,
    onchainVerdictOutcome: onchain.verdict_outcome || "",
    onchainVerdictAction: onchain.verdict_action || "",
    reviewCount: onchain.review_count ?? 0,
    disputeId: onchain.dispute_id || cached?.disputeId,
    submittedAt: onchain.submitted_at || cached?.createdAt,
  };
}

export async function fetchProof(id: string): Promise<any | null> {
  const cached = await cacheGetProof(id);
  if (!isContractConfigured()) return cached || null;
  try {
    const raw = await read("get_proof", [id]);
    const parsed = safeJson(raw);
    const merged = parsed ? normalizeProofRecord(parsed, cached) : null;
    if (merged) {
      await cachePutProof(merged);
      return merged;
    }
  } catch (e) { console.warn("get_proof failed", e); }
  return cached || null;
}

export async function fetchReview(proofId: string): Promise<any | null> {
  const cached = await cacheGetReview(proofId);
  if (!isContractConfigured()) return cached || null;
  try {
    const raw = await read("get_review", [proofId]);
    const parsed = safeJson(raw);
    if (parsed) {
      const verdict = parsed.verdict || parsed;
      const next = {
        ...(cached || {}),
        proofId,
        verdict,
        reviewedAt: parsed.reviewed_at || cached?.reviewedAt,
        reviewedBy: parsed.reviewed_by || cached?.reviewedBy,
      };
      await cachePutReview(next);
      return next;
    }
  } catch (e) { console.warn("get_review failed", e); }
  return cached || null;
}

// ---------- Bulk for dashboard ----------

export async function fetchUserContracts(addr: string): Promise<any[]> {
  const ids = await fetchUserContractIds(addr);
  if (ids.length === 0) {
    const cached = await cacheListContracts();
    return cached.filter((c: any) =>
      (c.client?.toLowerCase() === addr?.toLowerCase()) ||
      (c.worker?.toLowerCase() === addr?.toLowerCase())
    );
  }
  const results = await Promise.all(ids.map((id) => fetchContract(id)));
  return results.filter(Boolean);
}

export async function fetchProofsForContract(contractId: string): Promise<any[]> {
  // No on-chain enumeration of contract->proofs is exposed today.
  // Use the local cache and refresh each entry's on-chain state.
  const localAll = await cacheListProofs();
  const local = localAll.filter((p: any) => p.contractId === contractId);
  if (!isContractConfigured()) return local;
  const refreshed = await Promise.all(local.map((p: any) => fetchProof(p.id)));
  return refreshed.filter(Boolean);
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
