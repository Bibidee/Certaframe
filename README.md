# CertaFrame

**GenLayer-native multimodal performance proof protocol.**

> Hashes prove what was submitted. Signatures prove who submitted it. GenLayer judges whether the submitted visual proof satisfies the task.

CertaFrame is a Next.js 15 dApp on GenLayer Studionet where:

- a client defines a visual task contract and acceptance criteria,
- a worker uploads before/after evidence and signs an EIP-712 proof envelope,
- the `CertaFrameVerifier` intelligent contract stores the proof commitment,
- GenLayer validators perform a multimodal review of the visual evidence,
- the contract stores a structured verdict that the UI maps to an action.

## Why GenLayer

Visual task completion is non-deterministic. A traditional smart contract can store
a photo hash but cannot decide whether a wall is actually painted, whether before
and after images show the same site, or whether evidence is sufficient. CertaFrame
delegates that judgement to GenLayer validator consensus.

## What is proven vs. judged

| Cryptography proves | Cryptography does NOT prove |
|---|---|
| Image bytes match the recorded SHA-256 hash | The image is truthful |
| Proof packet was signed by the worker wallet | Image was taken at the claimed place |
| Envelope was not changed after signing | Image was not staged |
| Review result is linked to a specific proof hash | Work was safe or legal |
| | Task is fully complete outside the camera frame |

Provenance metadata (C2PA / Content Credentials) is useful but is **not** performance
proof. CertaFrame separates the *provenance* question (was the media signed and
traceable?) from the *performance* question (does it satisfy the task?). GenLayer
handles the second.

## This is not legal certification

CertaFrame provides AI-consensus review of submitted visual evidence. It does not
guarantee authenticity, legality, safety compliance, or full real-world completion
outside the submitted evidence. Do not use it as the only inspection mechanism for
safety-critical work, regulated compliance, medical evidence, law enforcement, or
structural engineering certification.

## Stack

- Next.js 15 (App Router), TypeScript strict
- Tailwind (custom Forensic Field Glass palette)
- wagmi + viem + injected wallet connector
- GenLayer JS SDK (`genlayer-js` 1.2+) targeting Studionet (chain 61999)
- Zod, Framer Motion, Lucide React, date-fns
- IndexedDB (idb) for local proof storage, Web Crypto for SHA-256
- npm only

No Privy, no embedded email wallet, no WalletConnect.

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
NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS=
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_EXPLORER_URL=https://explorer-studio.genlayer.com
NEXT_PUBLIC_STORAGE_MODE=local
NEXT_PUBLIC_USE_LOCAL_STORAGE=true
PINATA_JWT=
CLOUDFLARE_R2_BUCKET=
```

If the contract address is missing the dashboard shows:

```
GenLayer contract is not configured yet.
Deploy CertaFrameVerifier and add NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS to enable live visual proof review.
```

## Contract

`contracts/CertaFrameVerifier.py` is the GenLayer intelligent contract. Deterministic
methods record contracts, proof commitments, disputes, and protocol stats.
`review_visual_proof` is the non-deterministic GenLayer method — it runs the
multimodal prompt against the before/after images and converges validators on the
structured verdict fields (`outcome`, `taskCompletion`, `visualContinuity`,
`recommendedAction`). Reasoning may vary across validators.

## Demo flow

1. Land on homepage, connect injected wallet.
2. Create a visual task contract with acceptance criteria.
3. Open the contract, click **Submit Proof**.
4. Upload before + after images; SHA-256 hashes appear under each frame.
5. Sign the EIP-712 proof envelope.
6. Open **Run Visual Review** (client/keeper/admin).
7. Verdict Lens shows outcome, confidence, criteria matched/unclear, risk flags, recommended action.
8. Inspect the full evidence trace in **Evidence Console**.

No fake review results are shown anywhere; the only illustrative content is clearly
labelled frames on the landing page.

## Build

```bash
npm run build
npm run lint
```
