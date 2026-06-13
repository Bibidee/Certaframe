"use client";
import { CONTRACT_ADDRESS, GENLAYER_STUDIONET } from "./config";

declare global { interface Window { ethereum?: any } }

const STUDIONET_HEX = "0x" + GENLAYER_STUDIONET.chainId.toString(16);

export async function getConnectedWalletAddress(): Promise<`0x${string}`> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet found. Please install/enable MetaMask, Rabby, or a compatible wallet.");
  }
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  const account = accounts?.[0];
  if (!account) throw new Error("No wallet account connected.");
  return account as `0x${string}`;
}

async function ensureStudionetChain() {
  if (!window.ethereum) return;
  let currentId: string | undefined;
  try { currentId = await window.ethereum.request({ method: "eth_chainId" }); } catch {}
  if (currentId?.toLowerCase() === STUDIONET_HEX.toLowerCase()) return;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: STUDIONET_HEX }],
    });
  } catch (e: any) {
    if (e?.code === 4902 || /unrecognized chain/i.test(e?.message || "")) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: STUDIONET_HEX,
          chainName: GENLAYER_STUDIONET.name,
          nativeCurrency: { name: GENLAYER_STUDIONET.currency, symbol: GENLAYER_STUDIONET.currency, decimals: 18 },
          rpcUrls: [GENLAYER_STUDIONET.rpcUrl],
          blockExplorerUrls: [GENLAYER_STUDIONET.explorerUrl],
        }],
      });
    } else { throw e; }
  }
}

export async function getGenLayerWriteClient(): Promise<{ client: any; account: `0x${string}` }> {
  const account = await getConnectedWalletAddress();
  await ensureStudionetChain();
  const { createClient } = await import("genlayer-js");
  const { studionet } = await import("genlayer-js/chains");
  // Pass account as an ADDRESS STRING (not object) so the SDK transport routes
  // eth_sendTransaction through window.ethereum (works with Rabby, MetaMask, Brave, any injected).
  const client = createClient({ chain: studionet, account } as any);
  return { client, account };
}

export async function getGenLayerReadClient(): Promise<any> {
  const { createClient } = await import("genlayer-js");
  const { studionet } = await import("genlayer-js/chains");
  return createClient({ chain: studionet } as any);
}

export function requireContract(): `0x${string}` {
  if (!CONTRACT_ADDRESS) throw new Error("NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS not set");
  return CONTRACT_ADDRESS as `0x${string}`;
}

export type WriteResult = { hash: `0x${string}`; explorerUrl: string; receipt?: any };

export async function writeAndWait(functionName: string, args: any[]): Promise<WriteResult> {
  const { client } = await getGenLayerWriteClient();
  const address = requireContract();
  const raw = await client.writeContract({ address, functionName, args, value: BigInt(0) });
  const txHash = (typeof raw === "string" ? raw : raw?.hash || raw?.transaction_hash) as `0x${string}`;
  let receipt: any;
  try {
    const { TransactionStatus } = await import("genlayer-js/types");
    receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.ACCEPTED,
      retries: 120,
      interval: 3000,
    });
  } catch (e) {
    console.warn("waitForTransactionReceipt failed", e);
  }
  const exec = receipt?.consensus_data?.leader_receipt?.[0] || receipt?.consensus_data?.leader_receipt || receipt;
  const resultCode = exec?.execution_result || exec?.result || receipt?.result || receipt?.execution_result;
  const errMsg = exec?.error_message || exec?.error || receipt?.error_message;
  if (typeof resultCode === "string" && /rollback|reverted|error/i.test(resultCode)) {
    // Don't throw for review_visual_proof — leader verdict is still useful even if
    // consensus came back UNDETERMINED. The caller decides what to do with it.
    if (functionName !== "review_visual_proof") {
      const tail = errMsg ? ` (${errMsg})` : "";
      throw new Error(`GenLayer transaction ${functionName} rolled back${tail}. Tx: ${txHash}`);
    }
  }
  return { hash: txHash, explorerUrl: `${GENLAYER_STUDIONET.explorerUrl}/tx/${txHash}`, receipt };
}

export async function read(functionName: string, args: any[] = []): Promise<any> {
  const client = await getGenLayerReadClient();
  const address = requireContract();
  return client.readContract({ address, functionName, args });
}
