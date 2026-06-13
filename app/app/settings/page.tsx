"use client";
import { useAccount } from "wagmi";
import { GENLAYER_STUDIONET, CONTRACT_ADDRESS, isContractConfigured } from "@/src/lib/genlayer/config";

export default function Page() {
  const { address } = useAccount();
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-5">
      <span className="section-label">Settings</span>
      <h1 className="font-display text-5xl text-optic">Field Tablet</h1>
      <div className="glass-panel">
        <span className="section-label">Wallet</span>
        <p className="font-mono text-sm text-optic mt-1">{address || "Not connected"}</p>
        <p className="text-xs text-silver mt-2">Works with MetaMask, Rabby, Brave, or any injected wallet. Signs EIP-712 proof envelopes and Studionet contract writes.</p>
      </div>
      <div className="glass-panel">
        <span className="section-label">GenLayer Studionet</span>
        <ul className="mt-2 text-sm space-y-1 font-mono text-bone">
          <li>chain id: {GENLAYER_STUDIONET.chainId}</li>
          <li>rpc: {GENLAYER_STUDIONET.rpcUrl}</li>
          <li>explorer: <a href={GENLAYER_STUDIONET.explorerUrl} target="_blank">{GENLAYER_STUDIONET.explorerUrl}</a></li>
          <li>contract: {CONTRACT_ADDRESS || "(not configured)"}</li>
          <li>status: {isContractConfigured() ? "configured" : "missing NEXT_PUBLIC_GENLAYER_CONTRACT_ADDRESS"}</li>
        </ul>
      </div>
    </main>
  );
}
