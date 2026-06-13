"use client";
import Link from "next/link";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";

export function TopBar() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <header className="border-b border-cyan2/20 bg-carbon/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-5 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-optic">
          <span className="font-display text-2xl tracking-wider">CERTAFRAME</span>
          <span className="hidden md:inline text-[10px] font-mono uppercase tracking-widest text-cyan2">Forensic Field Glass</span>
        </Link>
        <nav className="hidden md:flex items-center gap-5 text-xs font-mono uppercase tracking-widest text-silver">
          <Link href="/how-it-works">How</Link>
          <Link href="/examples">Examples</Link>
          <Link href="/safety">Safety</Link>
          <Link href="/app/dashboard" className="text-optic">Dashboard</Link>
          <Link href="/app/console" className="text-cyan2">Evidence Console</Link>
        </nav>
        <div>
          {isConnected ? (
            <button onClick={() => disconnect()} className="btn-secondary" title="Wallet connected · Studionet ready">
              {address?.slice(0, 6)}…{address?.slice(-4)} · Disconnect
            </button>
          ) : (
            <button onClick={() => connect({ connector: injected() })} className="btn-primary">
              <span className="lens-circle" />Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
