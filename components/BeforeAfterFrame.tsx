"use client";
import { useEffect, useState } from "react";
import { getImage } from "@/src/lib/storage";

export function BeforeAfterFrame({ beforeHash, afterHash }: { beforeHash?: string; afterHash?: string }) {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ImageFrame label="Before" hash={beforeHash} />
      <ImageFrame label="After" hash={afterHash} />
    </div>
  );
}

export function ImageFrame({ label, hash }: { label: string; hash?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    if (!hash) return;
    getImage(hash).then((b) => {
      if (alive && b) setUrl(URL.createObjectURL(b));
    });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);
  return (
    <div className="glass-panel">
      <div className="flex justify-between mb-2">
        <span className="section-label">{label}</span>
        {hash && <span className="hash-strip">{hash.slice(0, 14)}…</span>}
      </div>
      <div className="aspect-square border border-cyan2/20 bg-lens flex items-center justify-center overflow-hidden">
        {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <span className="text-silver text-xs font-mono">NO EVIDENCE</span>}
      </div>
    </div>
  );
}
