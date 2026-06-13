"use client";
import { openDB, IDBPDatabase } from "idb";

const DB_NAME = "certaframe";
const VERSION = 1;

async function db(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("contracts")) db.createObjectStore("contracts", { keyPath: "id" });
      if (!db.objectStoreNames.contains("proofs")) db.createObjectStore("proofs", { keyPath: "id" });
      if (!db.objectStoreNames.contains("reviews")) db.createObjectStore("reviews", { keyPath: "proofId" });
      if (!db.objectStoreNames.contains("images")) db.createObjectStore("images", { keyPath: "hash" });
    },
  });
}

export async function putContract(c: any) { (await db()).put("contracts", c); }
export async function getContract(id: string) { return (await db()).get("contracts", id); }
export async function listContracts() { return (await db()).getAll("contracts"); }

export async function putProof(p: any) { (await db()).put("proofs", p); }
export async function getProof(id: string) { return (await db()).get("proofs", id); }
export async function listProofs() { return (await db()).getAll("proofs"); }
export async function proofsForContract(contractId: string) {
  const all = await listProofs(); return all.filter((p: any) => p.contractId === contractId);
}

export async function putReview(r: any) { (await db()).put("reviews", r); }
export async function getReview(proofId: string) { return (await db()).get("reviews", proofId); }

export async function putImage(hash: string, blob: Blob) { (await db()).put("images", { hash, blob }); }
export async function getImage(hash: string): Promise<Blob | null> {
  const rec: any = await (await db()).get("images", hash);
  return rec?.blob || null;
}
