import { z } from "zod";

export type ProofEnvelope = {
  contractId: string;
  taskId: string;
  submitter: `0x${string}`;
  beforeImageHash?: string;
  afterImageHash: string;
  metadataHash: string;
  claim: string;
  createdAt: string;
  nonce: string;
};

export const ProofEnvelopeSchema = z.object({
  contractId: z.string().min(1),
  taskId: z.string().min(1),
  submitter: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  beforeImageHash: z.string().optional(),
  afterImageHash: z.string().min(3),
  metadataHash: z.string().min(3),
  claim: z.string().min(1),
  createdAt: z.string().min(1),
  nonce: z.string().min(1),
});

export const EIP712_DOMAIN = {
  name: "CertaFrame",
  version: "1",
  chainId: 61999,
} as const;

export const EIP712_TYPES = {
  ProofEnvelope: [
    { name: "contractId", type: "string" },
    { name: "taskId", type: "string" },
    { name: "submitter", type: "address" },
    { name: "beforeImageHash", type: "string" },
    { name: "afterImageHash", type: "string" },
    { name: "metadataHash", type: "string" },
    { name: "claim", type: "string" },
    { name: "createdAt", type: "string" },
    { name: "nonce", type: "string" },
  ],
} as const;

export function buildEnvelope(p: Omit<ProofEnvelope, "createdAt" | "nonce"> & { nonce?: string }): ProofEnvelope {
  return {
    ...p,
    beforeImageHash: p.beforeImageHash || "",
    createdAt: new Date().toISOString(),
    nonce: p.nonce || crypto.randomUUID(),
  };
}
