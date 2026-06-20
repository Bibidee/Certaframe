# CertaFrame

**On-chain visual proof verification protocol built on GenLayer.**

> CertaFrame is an on-chain visual proof verification protocol built on GenLayer. It lets clients and workers create performance-based task contracts where completion is verified by GenLayer's nondeterministic AI validators, not human judgment or centralized servers. Workers submit cryptographic proof packets (before/after image hashes and signed envelopes). Validators run a visual review and return a structured verdict (VERIFIED, REVISION_REQUIRED, ESCALATED, etc.). Disputes are adjudicated fully on-chain by the same validator network. All state including contracts, proofs, reviews, disputes, and resolutions lives in the CertaFrameVerifier intelligent contract on Studionet. IndexedDB is cache only. The result is a tamper-resistant trust-minimized milestone payment rail where the AI is the arbitrator.

**GitHub:** https://github.com/Bibidee/Certaframe

---

## Why GenLayer

Visual task completion is non-deterministic. A traditional smart contract can store a photo hash but cannot decide whether a wall is actually painted, whether before and after images show the same site, or whether evidence is sufficient. CertaFrame delegates that judgement to GenLayer validator consensus.

## What is proven vs. judged

| Cryptography proves | Cryptography does NOT prove |
|---|---|
| Image bytes match the recorded SHA-256 hash | The image is truthful |
| Proof packet was signed by the worker wallet | Image was taken at the claimed place |
| Envelope was not changed after signing | Image was not staged |
| Review result is linked to a specific proof hash | Work was safe or legal |
| | Task is fully complete outside the camera frame |

## Verdict outcomes

| Outcome | Meaning | Contract status |
|---|---|---|
| VERIFIED | Evidence substantially satisfies criteria | ACCEPTED |
| VERIFIED_WITH_NOTES | Accepted with minor observations | ACCEPTED |
| REVISION_REQUIRED | Incomplete or unclear evidence | REVISION_REQUESTED |
| INSUFFICIENT_EVIDENCE | Cannot judge from submitted evidence | INSUFFICIENT_EVIDENCE |
| REJECTED | Evidence clearly fails criteria | REVISION_REQUESTED |
| ESCALATED | Requires human or regulated review | ESCALATED |
| UNDETERMINED | Genuinely impossible to judge | ESCALATED |

## This is not legal certification

CertaFrame provides AI-consensus review of submitted visual evidence. It does not guarantee authenticity, legality, safety compliance, or full real-world completion outside the submitted evidence. Do not use it as the only inspection mechanism for safety-critical work, regulated compliance, medical evidence, law enforcement, or structural engineering certification.

## Stack

- Next.js 15 (App Router), TypeScript strict
- Tailwind (custom Forensic Field Glass palette)
- wagmi + viem + injected wallet connector
- GenLayer JS SDK (`genlayer-js` 1.1.8) targeting Studionet (chain 61999)
- Zod, Framer Motion, Lucide React, date-fns
- IndexedDB (idb) for local image cache only — chain is source of truth
- Web Crypto API for SHA-256 hashing
- npm only

No Privy, no embedded email wallet, no WalletConnect, no fake verdicts.

## Contract

`contracts/CertaFrameVerifier.py` is the GenLayer intelligent contract deployed at `0x794552660CC39a89F044194F22a825a005b01075` on Studionet.

Write methods: `create_contract`, `submit_proof_commitment`, `review_visual_proof`, `record_dispute`, `resolve_dispute`, `confirm_milestone`, `request_revision`, `close_contract`

View methods: `get_contract`, `get_proof`, `get_review`, `get_dispute`, `get_resolution`, `get_contract_proofs`, `get_user_contracts`, `get_protocol_stats`, `is_keeper`, `get_admin`

`review_visual_proof` and `resolve_dispute` are the nondeterministic methods — they run AI prompts through GenLayer validator consensus and converge on a structured verdict.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS after deploying CertaFrameVerifier
npm run dev
```

### Environment

```env
NEXT_PUBLIC_APP_NAME=CertaFrame
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=0x794552660CC39a89F044194F22a825a005b01075
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
NEXT_PUBLIC_STORAGE_MODE=local
NEXT_PUBLIC_USE_LOCAL_STORAGE=true
```

## Demo flow

1. Connect injected wallet (MetaMask on GenLayer Studionet chain 61999).
2. Create a visual task contract with title, description, and acceptance criteria.
3. Worker opens the contract and clicks **Submit Proof** — uploads before and after images, signs EIP-712 proof envelope.
4. Client opens **Run Visual Review** — GenLayer validators assess the evidence (30-90s).
5. Verdict Lens displays outcome, confidence, criteria matched/unclear, risk flags, and recommended action.
6. Client clicks **Confirm Milestone** to close the contract on-chain, or **Request Revision** to send the worker back.
7. Either party can **Open Dispute** — resolved on-chain by GenLayer adjudication via `resolve_dispute`.
8. All tx hashes link to the GenLayer Studio Explorer.

## Build

```bash
npm run build
npm run lint
npm run test:smoke   # read-path smoke test against deployed contract
```
