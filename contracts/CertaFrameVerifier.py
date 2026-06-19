# v0.2.19
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json
import hashlib
from datetime import datetime, timezone


ALLOWED_CONTRACT_STATUS = (
    "ACTIVE",
    "PROOF_SUBMITTED",
    "UNDER_REVIEW",
    "ACCEPTED",
    "REVISION_REQUESTED",
    "INSUFFICIENT_EVIDENCE",
    "MISMATCH_RISK",
    "MANIPULATION_RISK",
    "ESCALATED",
    "DISPUTED",
    "CLOSED",
)

ALLOWED_PROOF_STATUS = (
    "PROOF_SUBMITTED",
    "UNDER_REVIEW",
    "REVIEWED",
    "DISPUTED",
    "SUPERSEDED",
)

ALLOWED_OUTCOMES = (
    "ACCEPT",
    "REQUEST_REVISION",
    "INSUFFICIENT_EVIDENCE",
    "POSSIBLE_MISMATCH",
    "POSSIBLE_MANIPULATION",
    "ESCALATE_TO_HUMAN",
)

ALLOWED_CONTINUITY = (
    "LIKELY_SAME_SITE",
    "UNCLEAR",
    "LIKELY_DIFFERENT_SITE",
)

ALLOWED_COMPLETION = (
    "COMPLETE",
    "PARTIAL",
    "NOT_SHOWN",
    "UNCLEAR",
)

ALLOWED_ACTIONS = (
    "confirm_milestone",
    "keep_pending",
    "request_more_evidence",
    "escalate",
)

ALLOWED_RESOLUTION_OUTCOMES = (
    "ACCEPT_PROOF",
    "REJECT_PROOF",
    "REQUEST_REVISION",
    "ESCALATE_TO_HUMAN",
    "INSUFFICIENT_EVIDENCE",
)

ALLOWED_RESOLUTION_CONFIDENCE = ("LOW", "MEDIUM", "HIGH")
ALLOWED_CRITERIA_RESULTS = ("SATISFIED", "PARTIALLY_SATISFIED", "NOT_SATISFIED", "UNCLEAR")
ALLOWED_NEXT_ACTIONS = ("NONE", "SUBMIT_MORE_EVIDENCE", "REWORK_REQUIRED", "MANUAL_REVIEW_REQUIRED")
ALLOWED_EVIDENCE_INTEGRITY = ("OK", "MISMATCH", "UNCLEAR")

# Verdict keywords the caller must not pre-smuggle into context_notes as a pre-decided outcome.
_VERDICT_SMUGGLE_KEYS = (
    '"outcome":', '"final_outcome":', '"resolution_verdict":', '"final_verdict":',
    '"approved":', '"rejected":', '"accepted":', '"resolved_outcome":',
)

DISPUTE_RESOLUTION_PROMPT = """
You are CertaFrameVerifier, a GenLayer dispute resolution adjudicator.

Your job:
Review the original task contract, the submitted proof hashes and envelope, and the dispute raised against it.
Determine whether the proof should be accepted, rejected, or needs revision.

Important limits:
- The dispute raiser's opinion is evidence, not the verdict. You decide.
- Judge only whether the proof satisfies the original contract acceptance criteria.
- Do not certify safety, legality, or regulatory compliance.
- Do not overclaim. If evidence is insufficient, say so.
- Return strict JSON only. No markdown. No commentary outside JSON.

Required JSON schema (all fields required, no extras):
{
  "outcome": "ACCEPT_PROOF | REJECT_PROOF | REQUEST_REVISION | ESCALATE_TO_HUMAN | INSUFFICIENT_EVIDENCE",
  "confidence": "LOW | MEDIUM | HIGH",
  "reason": "brief reason under 300 chars",
  "criteria_result": "SATISFIED | PARTIALLY_SATISFIED | NOT_SATISFIED | UNCLEAR",
  "required_next_action": "NONE | SUBMIT_MORE_EVIDENCE | REWORK_REQUIRED | MANUAL_REVIEW_REQUIRED",
  "evidence_integrity": "OK | MISMATCH | UNCLEAR"
}

Decision guide:
- ACCEPT_PROOF: The dispute is not convincing. The proof satisfies the contract criteria.
- REJECT_PROOF: The dispute is valid. The proof does not satisfy the criteria.
- REQUEST_REVISION: Partial satisfaction. More evidence or rework needed.
- ESCALATE_TO_HUMAN: Cannot be resolved from available evidence. Human review required.
- INSUFFICIENT_EVIDENCE: Not enough information to judge either way.

Outcome/action consistency rules:
- ACCEPT_PROOF → required_next_action must be NONE
- REJECT_PROOF → required_next_action must be REWORK_REQUIRED
- REQUEST_REVISION → required_next_action must be SUBMIT_MORE_EVIDENCE or REWORK_REQUIRED
- ESCALATE_TO_HUMAN → required_next_action must be MANUAL_REVIEW_REQUIRED
- INSUFFICIENT_EVIDENCE → required_next_action must be SUBMIT_MORE_EVIDENCE
"""

REVIEW_PROMPT = """
You are CertaFrameVerifier, a GenLayer visual evidence reviewer for
performance-based task contracts.

Your job:
Compare the task contract, acceptance criteria, before evidence, after evidence,
and supporting proof metadata. Judge whether the submitted evidence reasonably
shows the claimed task completion.

Important limits:
- Do not simply describe the images.
- Do not claim the image is guaranteed authentic.
- Do not certify safety, legality, building compliance, medical compliance,
  financial compliance, or regulated inspection.
- Do not assume facts not visible or provided.
- Do not overclaim.
- If the evidence is ambiguous, request revision or escalate.
- If before/after continuity is weak, flag mismatch risk.
- If staging, editing, inconsistency, or manipulation is suspected, flag manipulation risk.
- Judge only the submitted evidence against the stated task criteria.
- Return strict JSON only.
- No markdown.
- No commentary outside JSON.

Required JSON schema:
{
  "outcome": "ACCEPT | REQUEST_REVISION | INSUFFICIENT_EVIDENCE | POSSIBLE_MISMATCH | POSSIBLE_MANIPULATION | ESCALATE_TO_HUMAN",
  "confidence": number between 0 and 1,
  "visualContinuity": "LIKELY_SAME_SITE | UNCLEAR | LIKELY_DIFFERENT_SITE",
  "taskCompletion": "COMPLETE | PARTIAL | NOT_SHOWN | UNCLEAR",
  "criteriaMatched": [string],
  "criteriaUnclear": [string],
  "riskFlags": [string],
  "reasoning": string,
  "recommendedAction": "confirm_milestone | keep_pending | request_more_evidence | escalate"
}

Decision guide:
- ACCEPT only if the after evidence clearly satisfies the material acceptance criteria and continuity is not seriously doubtful.
- REQUEST_REVISION if some work appears done but evidence is incomplete, unclear, or missing important angles/details.
- INSUFFICIENT_EVIDENCE if the task cannot be judged from the submitted evidence.
- POSSIBLE_MISMATCH if before and after evidence may not show the same place, object, item, or work area.
- POSSIBLE_MANIPULATION if evidence appears staged, edited, inconsistent, or suspicious.
- ESCALATE_TO_HUMAN if the task requires human inspection, regulated judgement, safety/legal confirmation, or the evidence conflict cannot be resolved visually.
"""


def _require(cond, msg):
    if not cond:
        raise gl.vm.UserError(msg)


def _json_loads(raw, err):
    try:
        parsed = json.loads(raw)
        return parsed
    except Exception:
        raise gl.vm.UserError(err)


def _json_loads_object(raw, err):
    parsed = _json_loads(raw, err)
    _require(isinstance(parsed, dict), err)
    return parsed


def _json_dumps(data):
    return json.dumps(data, separators=(",", ":"), sort_keys=True)


def _addr(value):
    return str(value).lower().strip()


def _sender():
    return _addr(gl.message.sender_address)


def _is_nonempty_str(v):
    return isinstance(v, str) and bool(v.strip())


def _is_str_array(v):
    if not isinstance(v, list):
        return False
    for item in v:
        if not isinstance(item, str):
            return False
    return True


def _now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _extract_json_object(raw):
    text = str(raw).strip()

    if text.startswith("```"):
        lines = text.split("\n")
        kept = []
        for line in lines:
            if not line.strip().startswith("```"):
                kept.append(line)
        text = "\n".join(kept).strip()

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise gl.vm.UserError("validator_did_not_return_json_object")

    try:
        parsed = json.loads(text[start:end + 1])
    except Exception:
        raise gl.vm.UserError("validator_returned_invalid_json")

    _require(isinstance(parsed, dict), "validator_json_must_be_object")
    return parsed


def _review_equivalence_principle():
    return (
        "Two CertaFrame visual review outputs are equivalent if they agree on "
        "the same outcome, visualContinuity, taskCompletion, and recommendedAction. "
        "They must both avoid legal, safety, compliance, or authenticity guarantees, "
        "and must only judge whether the submitted evidence reasonably supports the "
        "task completion claim. Exact wording of reasoning, riskFlags, and criteria "
        "arrays does not need to match."
    )


def _empty_stats():
    return _json_dumps({
        "contracts": 0,
        "proofs": 0,
        "reviews": 0,
        "disputes": 0,
        "accept": 0,
        "revision": 0,
        "insufficient": 0,
        "mismatch": 0,
        "manipulation": 0,
        "escalate": 0,
        "keepers": 0,
    })


class CertaFrameVerifier(gl.Contract):
    contracts: TreeMap[str, str]
    proofs: TreeMap[str, str]
    reviews: TreeMap[str, str]
    disputes: TreeMap[str, str]
    resolutions: TreeMap[str, str]
    contract_proofs: TreeMap[str, str]
    user_contracts: TreeMap[str, str]
    keepers: TreeMap[str, str]
    stats: str
    admin: str

    def __init__(self):
        self.admin = _sender()
        self.stats = _empty_stats()
        self.keepers[self.admin] = "1"

    @gl.public.write
    def add_keeper(self, keeper: str) -> str:
        self._require_admin()
        k = _addr(keeper)
        _require(k != "", "keeper_required")
        if k in self.keepers and self.keepers[k] == "1":
            raise gl.vm.UserError("keeper_already_exists")
        self.keepers[k] = "1"
        self._bump("keepers")
        return _json_dumps({"keeper": k, "active": True})

    @gl.public.write
    def remove_keeper(self, keeper: str) -> str:
        self._require_admin()
        k = _addr(keeper)
        _require(k != "", "keeper_required")
        _require(k in self.keepers and self.keepers[k] == "1", "keeper_not_found")
        self.keepers[k] = "0"
        return _json_dumps({"keeper": k, "active": False})

    @gl.public.view
    def is_keeper(self, user: str) -> bool:
        u = _addr(user)
        if u not in self.keepers:
            return False
        return self.keepers[u] == "1"

    @gl.public.view
    def get_admin(self) -> str:
        return self.admin

    @gl.public.write
    def create_contract(self, contract_id: str, contract_json: str, contract_hash: str) -> str:
        _require(_is_nonempty_str(contract_id), "contract_id_required")
        _require(_is_nonempty_str(contract_json), "contract_json_required")
        _require(_is_nonempty_str(contract_hash), "contract_hash_required")
        _require(contract_id not in self.contracts, "contract_already_exists")

        payload = _json_loads_object(contract_json, "contract_json_must_be_valid_object")
        self._validate_contract_payload(payload)

        client = _addr(payload.get("client", ""))
        worker = _addr(payload.get("worker", ""))
        caller = _sender()

        _require(
            caller == client or self._is_admin(caller) or self._is_keeper_addr(caller),
            "only_client_admin_or_keeper_can_create_contract",
        )

        record = {
            "contract_id": contract_id,
            "contract_json": contract_json,
            "contract_hash": contract_hash,
            "client": client,
            "worker": worker,
            "status": "ACTIVE",
            "created_by": caller,
            "created_at": _now_iso(),
            "latest_proof_id": "",
            "latest_review_outcome": "",
            "latest_recommended_action": "",
            "close_reason": "",
            "closed_by": "",
        }

        self.contracts[contract_id] = _json_dumps(record)
        self._add_user_contract(client, contract_id)
        self._add_user_contract(worker, contract_id)
        self._bump("contracts")
        return contract_id

    @gl.public.write
    def submit_proof_commitment(self, proof_id: str, contract_id: str, proof_envelope_hash: str, image_hash_bundle_json: str) -> str:
        _require(_is_nonempty_str(proof_id), "proof_id_required")
        _require(_is_nonempty_str(contract_id), "contract_id_required")
        _require(_is_nonempty_str(proof_envelope_hash), "proof_envelope_hash_required")
        _require(_is_nonempty_str(image_hash_bundle_json), "image_hash_bundle_json_required")

        contract = self._get_contract_required(contract_id)
        _require(proof_id not in self.proofs, "proof_already_exists")

        status = str(contract.get("status", ""))
        _require(status in ("ACTIVE", "REVISION_REQUESTED", "INSUFFICIENT_EVIDENCE"), "contract_not_accepting_proof")

        caller = _sender()
        worker = _addr(contract.get("worker", ""))
        _require(caller == worker or self._is_admin(caller) or self._is_keeper_addr(caller), "only_worker_admin_or_keeper_can_submit_proof")

        bundle = _json_loads_object(image_hash_bundle_json, "image_hash_bundle_json_must_be_valid_object")
        self._validate_image_hash_bundle(bundle)

        old_latest = str(contract.get("latest_proof_id", ""))
        if old_latest != "" and old_latest in self.proofs:
            old_proof = _json_loads_object(self.proofs[old_latest], "stored_old_proof_corrupted")
            old_status = str(old_proof.get("status", ""))
            if old_status in ("PROOF_SUBMITTED", "UNDER_REVIEW"):
                raise gl.vm.UserError("previous_proof_still_pending")
            old_proof["status"] = "SUPERSEDED"
            self.proofs[old_latest] = _json_dumps(old_proof)

        proof_record = {
            "proof_id": proof_id,
            "contract_id": contract_id,
            "proof_envelope_hash": proof_envelope_hash,
            "image_hash_bundle": image_hash_bundle_json,
            "submitted_by": caller,
            "submitted_at": _now_iso(),
            "status": "PROOF_SUBMITTED",
            "review_count": 0,
            "verdict_outcome": "",
            "verdict_action": "",
            "dispute_id": "",
        }

        self.proofs[proof_id] = _json_dumps(proof_record)

        proof_ids = self._get_contract_proof_ids(contract_id)
        if proof_id not in proof_ids:
            proof_ids.append(proof_id)
        self.contract_proofs[contract_id] = _json_dumps(proof_ids)

        contract["status"] = "PROOF_SUBMITTED"
        contract["latest_proof_id"] = proof_id
        contract["latest_review_outcome"] = ""
        contract["latest_recommended_action"] = ""
        self.contracts[contract_id] = _json_dumps(contract)
        self._bump("proofs")
        return proof_id

    @gl.public.write
    def record_dispute(self, proof_id: str, dispute_id: str, dispute_json: str) -> str:
        _require(_is_nonempty_str(proof_id), "proof_id_required")
        _require(_is_nonempty_str(dispute_id), "dispute_id_required")
        _require(_is_nonempty_str(dispute_json), "dispute_json_required")
        _require(dispute_id not in self.disputes, "dispute_already_exists")

        proof = self._get_proof_required(proof_id)
        contract_id = str(proof.get("contract_id", ""))
        contract = self._get_contract_required(contract_id)

        caller = _sender()
        client = _addr(contract.get("client", ""))
        worker = _addr(contract.get("worker", ""))
        _require(caller == client or caller == worker or self._is_admin(caller) or self._is_keeper_addr(caller), "only_contract_parties_admin_or_keeper_can_dispute")

        dispute_payload = _json_loads_object(dispute_json, "dispute_json_must_be_valid_object")
        _require(_is_nonempty_str(dispute_payload.get("reason", "")), "dispute_reason_required")

        dispute_record = {
            "dispute_id": dispute_id,
            "proof_id": proof_id,
            "contract_id": contract_id,
            "raised_by": caller,
            "raised_at": _now_iso(),
            "dispute_json": dispute_json,
            "status": "OPEN",
        }

        self.disputes[dispute_id] = _json_dumps(dispute_record)
        proof["status"] = "DISPUTED"
        proof["dispute_id"] = dispute_id
        self.proofs[proof_id] = _json_dumps(proof)
        contract["status"] = "DISPUTED"
        self.contracts[contract_id] = _json_dumps(contract)
        self._bump("disputes")
        return dispute_id

    @gl.public.write
    def resolve_dispute(self, dispute_id: str, context_notes: str) -> str:
        _require(_is_nonempty_str(dispute_id), "dispute_id_required")
        _require(dispute_id in self.disputes, "dispute_not_found")

        dispute = _json_loads_object(self.disputes[dispute_id], "stored_dispute_corrupted")
        _require(dispute.get("status", "") == "OPEN", "dispute_already_resolved")

        proof_id = str(dispute.get("proof_id", ""))
        contract_id = str(dispute.get("contract_id", ""))

        proof = self._get_proof_required(proof_id)
        contract = self._get_contract_required(contract_id)

        caller = _sender()
        client = _addr(contract.get("client", ""))
        worker = _addr(contract.get("worker", ""))
        _require(
            caller == client or caller == worker or self._is_admin(caller) or self._is_keeper_addr(caller),
            "only_contract_parties_admin_or_keeper_can_resolve_dispute",
        )

        # Guard: reject context_notes that smuggle pre-decided outcome keys.
        notes_lower = str(context_notes).lower()
        for key in _VERDICT_SMUGGLE_KEYS:
            _require(key not in notes_lower, "context_notes_must_not_contain_pre_decided_verdict_fields")

        safe_notes = str(context_notes).strip()[:800] if _is_nonempty_str(context_notes) else "none"

        dispute_payload = _json_loads_object(dispute.get("dispute_json", "{}"), "dispute_json_corrupted")
        contract_json_str = contract.get("contract_json", "")

        resolution_prompt = (
            DISPUTE_RESOLUTION_PROMPT
            + "\n\nCONTRACT:\n"
            + _json_dumps({"contract_id": contract_id, "contract_json": contract_json_str})
            + "\n\nPROOF:\n"
            + _json_dumps({
                "proof_id": proof_id,
                "proof_envelope_hash": proof.get("proof_envelope_hash", ""),
                "image_hash_bundle": proof.get("image_hash_bundle", ""),
                "prior_verdict_outcome": proof.get("verdict_outcome", ""),
            })
            + "\n\nDISPUTE:\n"
            + _json_dumps({
                "dispute_id": dispute_id,
                "reason": dispute_payload.get("reason", ""),
                "raised_by": dispute.get("raised_by", ""),
                "raised_at": dispute.get("raised_at", ""),
            })
            + "\n\nADDITIONAL CONTEXT FROM PARTY:\n"
            + safe_notes
        )

        resolution = self._run_dispute_resolution(resolution_prompt)

        resolution_record = {
            "dispute_id": dispute_id,
            "proof_id": proof_id,
            "contract_id": contract_id,
            "resolved_by": caller,
            "resolved_at": _now_iso(),
            "resolution": resolution,
        }
        self.resolutions[dispute_id] = _json_dumps(resolution_record)

        # Update dispute status.
        dispute["status"] = "RESOLVED"
        dispute["resolved_at"] = _now_iso()
        dispute["resolved_by"] = caller
        self.disputes[dispute_id] = _json_dumps(dispute)

        # Update proof and contract status based on resolution outcome.
        outcome = resolution.get("outcome", "")
        if outcome == "ACCEPT_PROOF":
            proof["status"] = "REVIEWED"
            proof["verdict_outcome"] = "ACCEPT"
            contract["status"] = "ACCEPTED"
        elif outcome == "REJECT_PROOF":
            contract["status"] = "REVISION_REQUESTED"
        elif outcome == "REQUEST_REVISION":
            proof["status"] = "SUPERSEDED"
            contract["status"] = "REVISION_REQUESTED"
        elif outcome == "ESCALATE_TO_HUMAN":
            contract["status"] = "ESCALATED"
        elif outcome == "INSUFFICIENT_EVIDENCE":
            contract["status"] = "INSUFFICIENT_EVIDENCE"

        self.proofs[proof_id] = _json_dumps(proof)
        self.contracts[contract_id] = _json_dumps(contract)

        return _json_dumps(resolution_record)

    @gl.public.write
    def review_visual_proof(self, proof_id: str, review_payload_json: str) -> str:
        _require(_is_nonempty_str(proof_id), "proof_id_required")
        _require(_is_nonempty_str(review_payload_json), "review_payload_json_required")

        proof = self._get_proof_required(proof_id)
        contract_id = str(proof.get("contract_id", ""))
        contract = self._get_contract_required(contract_id)
        _require(proof.get("status", "") == "PROOF_SUBMITTED", "proof_is_not_ready_for_review")

        caller = _sender()
        client = _addr(contract.get("client", ""))
        _require(caller == client or self._is_admin(caller) or self._is_keeper_addr(caller), "only_client_admin_or_keeper_can_review_proof")

        payload = _json_loads_object(review_payload_json, "review_payload_json_must_be_valid_object")
        self._validate_review_payload(payload)

        contract["status"] = "UNDER_REVIEW"
        proof["status"] = "UNDER_REVIEW"
        self.contracts[contract_id] = _json_dumps(contract)
        self.proofs[proof_id] = _json_dumps(proof)

        contract_summary = {
            "contract_id": contract_id,
            "contract_hash": contract.get("contract_hash", ""),
            "client": contract.get("client", ""),
            "worker": contract.get("worker", ""),
            "contract_json": contract.get("contract_json", ""),
        }
        proof_summary = {
            "proof_id": proof_id,
            "proof_envelope_hash": proof.get("proof_envelope_hash", ""),
            "image_hash_bundle": proof.get("image_hash_bundle", ""),
        }
        full_prompt = REVIEW_PROMPT + "\n\nCONTRACT SUMMARY:\n" + _json_dumps(contract_summary) + "\n\nPROOF SUMMARY:\n" + _json_dumps(proof_summary) + "\n\nREVIEW PAYLOAD:\n" + _json_dumps(payload)
        verdict = self._run_visual_review(full_prompt)

        review_record = {
            "proof_id": proof_id,
            "contract_id": contract_id,
            "reviewed_by": caller,
            "reviewed_at": _now_iso(),
            "review_payload_hash": str(payload.get("review_payload_hash", "")),
            "verdict": verdict,
        }
        self.reviews[proof_id] = _json_dumps(review_record)

        proof = self._get_proof_required(proof_id)
        proof["status"] = "REVIEWED"
        proof["review_count"] = int(proof.get("review_count", 0)) + 1
        proof["verdict_outcome"] = verdict.get("outcome", "")
        proof["verdict_action"] = verdict.get("recommendedAction", "")
        self.proofs[proof_id] = _json_dumps(proof)

        contract = self._get_contract_required(contract_id)
        contract["latest_review_outcome"] = verdict.get("outcome", "")
        contract["latest_recommended_action"] = verdict.get("recommendedAction", "")
        contract["status"] = self._contract_status_from_verdict(verdict)
        self.contracts[contract_id] = _json_dumps(contract)

        self._bump("reviews")
        self._bump_outcome(verdict.get("outcome", ""))
        return _json_dumps(review_record)

    def _run_visual_review(self, full_prompt):
        def leader_fn():
            raw = gl.nondet.exec_prompt(full_prompt)
            parsed = _extract_json_object(raw)
            verdict = self._normalize_verdict(parsed)
            self._validate_verdict(verdict)
            return _json_dumps(verdict)

        result_json = gl.eq_principle.prompt_comparative(leader_fn, _review_equivalence_principle())
        verdict = _json_loads_object(result_json, "review_result_invalid_json")
        verdict = self._normalize_verdict(verdict)
        self._validate_verdict(verdict)
        return verdict

    @gl.public.write
    def close_contract(self, contract_id: str, close_reason: str) -> str:
        self._require_admin_or_keeper()
        _require(_is_nonempty_str(contract_id), "contract_id_required")
        _require(_is_nonempty_str(close_reason), "close_reason_required")
        contract = self._get_contract_required(contract_id)
        _require(contract.get("status", "") != "CLOSED", "contract_already_closed")
        contract["status"] = "CLOSED"
        contract["close_reason"] = close_reason
        contract["closed_by"] = _sender()
        contract["closed_at"] = _now_iso()
        self.contracts[contract_id] = _json_dumps(contract)
        return contract_id

    @gl.public.view
    def get_contract(self, contract_id: str) -> str:
        if contract_id not in self.contracts:
            return _json_dumps({"error": "contract_not_found"})
        return self.contracts[contract_id]

    @gl.public.view
    def get_proof(self, proof_id: str) -> str:
        if proof_id not in self.proofs:
            return _json_dumps({"error": "proof_not_found"})
        return self.proofs[proof_id]

    @gl.public.view
    def get_review(self, proof_id: str) -> str:
        if proof_id not in self.reviews:
            return _json_dumps({"error": "review_not_found"})
        return self.reviews[proof_id]

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> str:
        if dispute_id not in self.disputes:
            return _json_dumps({"error": "dispute_not_found"})
        return self.disputes[dispute_id]

    @gl.public.view
    def get_resolution(self, dispute_id: str) -> str:
        if dispute_id not in self.resolutions:
            return _json_dumps({"error": "resolution_not_found"})
        return self.resolutions[dispute_id]

    @gl.public.view
    def get_contract_proofs(self, contract_id: str) -> str:
        if contract_id not in self.contract_proofs:
            return _json_dumps([])
        return self.contract_proofs[contract_id]

    @gl.public.view
    def get_user_contracts(self, user_address: str) -> str:
        user = _addr(user_address)
        if user not in self.user_contracts:
            return _json_dumps([])
        return self.user_contracts[user]

    @gl.public.view
    def get_my_contracts(self) -> str:
        user = _sender()
        if user not in self.user_contracts:
            return _json_dumps([])
        return self.user_contracts[user]

    @gl.public.view
    def get_protocol_stats(self) -> str:
        return self.stats

    def _run_dispute_resolution(self, full_prompt):
        def leader_fn():
            raw = gl.nondet.exec_prompt(full_prompt)
            parsed = _extract_json_object(raw)
            resolution = self._normalize_resolution(parsed)
            self._validate_resolution(resolution)
            return _json_dumps(resolution)

        result_json = gl.eq_principle.prompt_comparative(leader_fn, self._dispute_resolution_equivalence())
        resolution = _json_loads_object(result_json, "resolution_result_invalid_json")
        resolution = self._normalize_resolution(resolution)
        self._validate_resolution(resolution)
        return resolution

    def _normalize_resolution(self, v):
        if not isinstance(v, dict):
            v = {}
        return {
            "outcome": str(v.get("outcome", "")).strip(),
            "confidence": str(v.get("confidence", "LOW")).strip(),
            "reason": str(v.get("reason", "")).strip()[:300],
            "criteria_result": str(v.get("criteria_result", "UNCLEAR")).strip(),
            "required_next_action": str(v.get("required_next_action", "MANUAL_REVIEW_REQUIRED")).strip(),
            "evidence_integrity": str(v.get("evidence_integrity", "UNCLEAR")).strip(),
        }

    def _validate_resolution(self, v):
        _require(isinstance(v, dict), "resolution_must_be_object")
        _require(v.get("outcome", "") in ALLOWED_RESOLUTION_OUTCOMES, "invalid_resolution_outcome")
        _require(v.get("confidence", "") in ALLOWED_RESOLUTION_CONFIDENCE, "invalid_resolution_confidence")
        _require(v.get("criteria_result", "") in ALLOWED_CRITERIA_RESULTS, "invalid_criteria_result")
        _require(v.get("required_next_action", "") in ALLOWED_NEXT_ACTIONS, "invalid_required_next_action")
        _require(v.get("evidence_integrity", "") in ALLOWED_EVIDENCE_INTEGRITY, "invalid_evidence_integrity")
        outcome = v.get("outcome", "")
        action = v.get("required_next_action", "")
        if outcome == "ACCEPT_PROOF":
            _require(action == "NONE", "accept_proof_must_have_none_action")
        elif outcome == "REJECT_PROOF":
            _require(action == "REWORK_REQUIRED", "reject_proof_must_have_rework_action")
        elif outcome == "REQUEST_REVISION":
            _require(action in ("SUBMIT_MORE_EVIDENCE", "REWORK_REQUIRED"), "request_revision_must_have_evidence_or_rework")
        elif outcome == "ESCALATE_TO_HUMAN":
            _require(action == "MANUAL_REVIEW_REQUIRED", "escalate_must_have_manual_review")
        elif outcome == "INSUFFICIENT_EVIDENCE":
            _require(action == "SUBMIT_MORE_EVIDENCE", "insufficient_evidence_must_request_evidence")

    def _dispute_resolution_equivalence(self):
        return (
            "Two CertaFrame dispute resolution outputs are equivalent if they agree on "
            "the same outcome, criteria_result, and required_next_action. "
            "The exact wording of reason does not need to match, but the core judgment must be the same."
        )

    def _validate_contract_payload(self, p):
        _require(isinstance(p, dict), "contract_json_must_be_object")
        client = p.get("client", "")
        worker = p.get("worker", "")
        _require(_is_nonempty_str(client), "client_required")
        _require(_is_nonempty_str(worker), "worker_required")
        _require(_addr(client) != _addr(worker), "client_and_worker_must_differ")
        task_text = p.get("task") or p.get("task_description") or p.get("description") or p.get("title") or ""
        _require(_is_nonempty_str(task_text), "task_description_required")
        criteria = p.get("acceptance_criteria") or p.get("criteria") or p.get("milestones") or []
        _require(_is_str_array(criteria), "acceptance_criteria_must_be_array_of_strings")
        _require(len(criteria) > 0, "at_least_one_acceptance_criterion_required")

    def _validate_image_hash_bundle(self, b):
        _require(isinstance(b, dict), "image_hash_bundle_must_be_object")
        has_before = _is_nonempty_str(b.get("before_hash", "")) or _is_nonempty_str(b.get("beforeImageHash", "")) or _is_str_array(b.get("before_hashes", []))
        has_after = _is_nonempty_str(b.get("after_hash", "")) or _is_nonempty_str(b.get("afterImageHash", "")) or _is_str_array(b.get("after_hashes", []))
        _require(has_before, "before_image_hash_required")
        _require(has_after, "after_image_hash_required")

    def _validate_review_payload(self, p):
        _require(isinstance(p, dict), "review_payload_must_be_object")
        task_text = p.get("task") or p.get("task_description") or p.get("description") or ""
        _require(_is_nonempty_str(task_text), "review_task_description_required")
        criteria = p.get("acceptance_criteria") or p.get("criteria") or []
        _require(_is_str_array(criteria), "review_criteria_must_be_array_of_strings")
        _require(len(criteria) > 0, "review_criteria_required")
        has_before_reference = _is_nonempty_str(p.get("before_image_url", "")) or _is_nonempty_str(p.get("beforeImageUrl", "")) or _is_nonempty_str(p.get("before_image_description", "")) or _is_nonempty_str(p.get("beforeImageDescription", ""))
        has_after_reference = _is_nonempty_str(p.get("after_image_url", "")) or _is_nonempty_str(p.get("afterImageUrl", "")) or _is_nonempty_str(p.get("after_image_description", "")) or _is_nonempty_str(p.get("afterImageDescription", ""))
        _require(has_before_reference, "before_image_reference_or_description_required")
        _require(has_after_reference, "after_image_reference_or_description_required")

    def _normalize_verdict(self, v):
        if not isinstance(v, dict):
            v = {}
        criteria_matched = v.get("criteriaMatched", [])
        criteria_unclear = v.get("criteriaUnclear", [])
        risk_flags = v.get("riskFlags", [])
        if not isinstance(criteria_matched, list):
            criteria_matched = []
        if not isinstance(criteria_unclear, list):
            criteria_unclear = []
        if not isinstance(risk_flags, list):
            risk_flags = []
        confidence = v.get("confidence", 0)
        try:
            confidence = float(confidence)
        except Exception:
            confidence = 0.0
        if confidence < 0:
            confidence = 0.0
        if confidence > 1:
            confidence = 1.0
        return {
            "outcome": str(v.get("outcome", "")).strip(),
            "confidence": confidence,
            "visualContinuity": str(v.get("visualContinuity", "")).strip(),
            "taskCompletion": str(v.get("taskCompletion", "")).strip(),
            "criteriaMatched": [str(x)[:300] for x in criteria_matched[:12]],
            "criteriaUnclear": [str(x)[:300] for x in criteria_unclear[:12]],
            "riskFlags": [str(x)[:300] for x in risk_flags[:12]],
            "reasoning": str(v.get("reasoning", "")).strip()[:1200],
            "recommendedAction": str(v.get("recommendedAction", "")).strip(),
        }

    def _validate_verdict(self, v):
        _require(isinstance(v, dict), "verdict_must_be_object")
        required = ("outcome", "confidence", "visualContinuity", "taskCompletion", "criteriaMatched", "criteriaUnclear", "riskFlags", "reasoning", "recommendedAction")
        for key in required:
            _require(key in v, "missing_field_" + key)
        _require(v["outcome"] in ALLOWED_OUTCOMES, "invalid_outcome")
        _require(v["visualContinuity"] in ALLOWED_CONTINUITY, "invalid_visualContinuity")
        _require(v["taskCompletion"] in ALLOWED_COMPLETION, "invalid_taskCompletion")
        _require(v["recommendedAction"] in ALLOWED_ACTIONS, "invalid_recommendedAction")
        try:
            c = float(v["confidence"])
        except Exception:
            raise gl.vm.UserError("confidence_must_be_number")
        _require(c >= 0 and c <= 1, "confidence_must_be_in_0_1")
        _require(_is_str_array(v["criteriaMatched"]), "criteriaMatched_must_be_string_array")
        _require(_is_str_array(v["criteriaUnclear"]), "criteriaUnclear_must_be_string_array")
        _require(_is_str_array(v["riskFlags"]), "riskFlags_must_be_string_array")
        _require(_is_nonempty_str(v["reasoning"]), "reasoning_must_be_non_empty_string")
        outcome = v["outcome"]
        action = v["recommendedAction"]
        if outcome == "ACCEPT":
            _require(action == "confirm_milestone", "accept_must_confirm_milestone")
        if outcome in ("REQUEST_REVISION", "INSUFFICIENT_EVIDENCE"):
            _require(action in ("request_more_evidence", "keep_pending"), "revision_or_evidence_outcome_must_keep_pending_or_request_evidence")
        if outcome in ("POSSIBLE_MISMATCH", "POSSIBLE_MANIPULATION", "ESCALATE_TO_HUMAN"):
            _require(action == "escalate", "risk_or_escalation_outcome_must_escalate")

    def _contract_status_from_verdict(self, verdict):
        outcome = verdict.get("outcome", "")
        if outcome == "ACCEPT":
            return "ACCEPTED"
        if outcome == "REQUEST_REVISION":
            return "REVISION_REQUESTED"
        if outcome == "INSUFFICIENT_EVIDENCE":
            return "INSUFFICIENT_EVIDENCE"
        if outcome == "POSSIBLE_MISMATCH":
            return "MISMATCH_RISK"
        if outcome == "POSSIBLE_MANIPULATION":
            return "MANIPULATION_RISK"
        if outcome == "ESCALATE_TO_HUMAN":
            return "ESCALATED"
        return "ESCALATED"

    def _get_contract_required(self, contract_id):
        _require(contract_id in self.contracts, "unknown_contract")
        return _json_loads_object(self.contracts[contract_id], "stored_contract_corrupted")

    def _get_proof_required(self, proof_id):
        _require(proof_id in self.proofs, "unknown_proof")
        return _json_loads_object(self.proofs[proof_id], "stored_proof_corrupted")

    def _get_contract_proof_ids(self, contract_id):
        if contract_id not in self.contract_proofs:
            return []
        try:
            arr = json.loads(self.contract_proofs[contract_id])
            if isinstance(arr, list):
                return arr
        except Exception:
            pass
        return []

    def _add_user_contract(self, user, contract_id):
        u = _addr(user)
        if u == "":
            return
        if u in self.user_contracts:
            try:
                arr = json.loads(self.user_contracts[u])
                if not isinstance(arr, list):
                    arr = []
            except Exception:
                arr = []
        else:
            arr = []
        if contract_id not in arr:
            arr.append(contract_id)
        self.user_contracts[u] = _json_dumps(arr)

    def _is_admin(self, user):
        return _addr(user) == _addr(self.admin)

    def _is_keeper_addr(self, user):
        u = _addr(user)
        if u not in self.keepers:
            return False
        return self.keepers[u] == "1"

    def _require_admin(self):
        _require(self._is_admin(_sender()), "admin_only")

    def _require_admin_or_keeper(self):
        caller = _sender()
        _require(self._is_admin(caller) or self._is_keeper_addr(caller), "admin_or_keeper_only")

    def _bump(self, key):
        try:
            s = json.loads(self.stats)
            if not isinstance(s, dict):
                s = {}
        except Exception:
            s = {}
        s[key] = int(s.get(key, 0)) + 1
        self.stats = _json_dumps(s)

    def _bump_outcome(self, outcome):
        mapping = {
            "ACCEPT": "accept",
            "REQUEST_REVISION": "revision",
            "INSUFFICIENT_EVIDENCE": "insufficient",
            "POSSIBLE_MISMATCH": "mismatch",
            "POSSIBLE_MANIPULATION": "manipulation",
            "ESCALATE_TO_HUMAN": "escalate",
        }
        key = mapping.get(outcome, "")
        if key != "":
            self._bump(key)