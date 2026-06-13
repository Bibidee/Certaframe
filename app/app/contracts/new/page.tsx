"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import { putContract } from "@/src/lib/storage";
import { sha256Hex } from "@/src/lib/hash";
import { writeAndWait } from "@/src/lib/genlayer/client";
import { isContractConfigured } from "@/src/lib/genlayer/config";

export default function Page() {
  const router = useRouter();
  const { address } = useAccount();
  const [form, setForm] = useState({
    title: "", worker: "", locationLabel: "", description: "",
    criteria: "", beforeRequired: true, afterRequired: true, sameAngle: true,
    deadline: "", strictness: "normal", escalation: "manual", paymentMode: "off-chain",
  });
  const [busy, setBusy] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: any) { setForm({ ...form, [k]: v }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return alert("Connect wallet first. Studionet write transactions require a connected account.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.worker.trim())) {
      return alert("Worker wallet is required (0x-prefixed 40-hex-character address).");
    }
    setBusy(true);
    const id = "c_" + crypto.randomUUID();
    const acceptance_criteria = form.criteria.split("\n").map((s) => s.trim()).filter(Boolean);
    if (acceptance_criteria.length === 0) {
      setBusy(false);
      return alert("Add at least one acceptance criterion.");
    }
    // Snake-case keys to match CertaFrameVerifier._validate_contract_payload.
    const onchainRecord = {
      contract_id: id,
      client: address.toLowerCase(),
      worker: form.worker.trim().toLowerCase(),
      title: form.title,
      location_label: form.locationLabel,
      description: form.description,
      acceptance_criteria,
      before_required: form.beforeRequired,
      after_required: form.afterRequired,
      same_angle: form.sameAngle,
      deadline: form.deadline,
      strictness: form.strictness,
      escalation: form.escalation,
      payment_mode: form.paymentMode,
      status: "ACTIVE",
      created_at: new Date().toISOString(),
    };
    const contractJson = JSON.stringify(onchainRecord);
    const contractHash = await sha256Hex(contractJson);
    // Local UI record keeps the camelCase view used by the rest of the app.
    const record = {
      id, client: address, worker: form.worker, title: form.title,
      locationLabel: form.locationLabel, description: form.description,
      acceptanceCriteria: acceptance_criteria,
      beforeRequired: form.beforeRequired, afterRequired: form.afterRequired, sameAngle: form.sameAngle,
      deadline: form.deadline, strictness: form.strictness, escalation: form.escalation,
      paymentMode: form.paymentMode, status: "ACTIVE",
      createdAt: onchainRecord.created_at,
    };

    let txHash = ""; let explorerUrl = "";
    if (isContractConfigured()) {
      try {
        const res = await writeAndWait("create_contract", [id, contractJson, contractHash]);
        txHash = res.hash; explorerUrl = res.explorerUrl;
      } catch (e: any) {
        setBusy(false);
        return alert("On-chain create_contract failed: " + (e?.shortMessage || e?.message || e));
      }
    }
    await putContract({ ...record, contractHash, txHash, explorerUrl });
    router.push(`/app/contracts/${id}`);
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <span className="section-label">New Proof Contract</span>
      <h1 className="font-display text-5xl text-optic mb-6">Define the Task</h1>
      <form onSubmit={submit} className="glass-panel space-y-4">
        <Field label="Contract title"><input className="inp" required value={form.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Worker wallet">
          <input
            className="inp"
            placeholder="0x…"
            required
            pattern="^0x[0-9a-fA-F]{40}$"
            title="Enter a valid 0x-prefixed 40-hex-character wallet address"
            value={form.worker}
            onChange={(e) => set("worker", e.target.value)}
          />
        </Field>
        <Field label="Task location label (not exact GPS)"><input className="inp" value={form.locationLabel} onChange={(e) => set("locationLabel", e.target.value)} /></Field>
        <Field label="Task description">
          <textarea className="inp" rows={3} required value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Acceptance criteria (one per line)">
          <textarea className="inp" rows={5} required value={form.criteria} onChange={(e) => set("criteria", e.target.value)}
            placeholder={"Same wall visible in before and after\nComplete white paint coverage\nNo visible large cracks"} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Toggle label="Before required" v={form.beforeRequired} on={(v) => set("beforeRequired", v)} />
          <Toggle label="After required" v={form.afterRequired} on={(v) => set("afterRequired", v)} />
          <Toggle label="Similar angle" v={form.sameAngle} on={(v) => set("sameAngle", v)} />
        </div>
        <Field label="Deadline"><input type="date" className="inp" value={form.deadline} onChange={(e) => set("deadline", e.target.value)} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Review strictness">
            <select className="inp" value={form.strictness} onChange={(e) => set("strictness", e.target.value)}>
              <option value="lenient">Lenient</option><option value="normal">Normal</option><option value="strict">Strict</option>
            </select>
          </Field>
          <Field label="Escalation">
            <select className="inp" value={form.escalation} onChange={(e) => set("escalation", e.target.value)}>
              <option value="manual">Manual</option><option value="rereview">Re-review</option>
            </select>
          </Field>
          <Field label="Payment mode">
            <select className="inp" value={form.paymentMode} onChange={(e) => set("paymentMode", e.target.value)}>
              <option value="off-chain">Off-chain reference</option><option value="gen-later">GEN later</option>
            </select>
          </Field>
        </div>
        <button disabled={busy} className="btn-primary"><span className="lens-circle"/>{busy ? "Sealing…" : "Seal Contract"}</button>
      </form>
      <style jsx global>{`
        .inp { width:100%; background:#0b1418; border:1px solid rgba(0,194,255,0.25); color:#EAF9FF;
          padding:0.6rem 0.7rem; font-family: var(--font-mono); font-size:0.85rem; border-radius:2px; }
        .inp:focus { outline: none; border-color: var(--cyan2); }
      `}</style>
    </main>
  );
}

function Field({ label, children }: any) {
  return <label className="block"><span className="section-label">{label}</span><div className="mt-1">{children}</div></label>;
}
function Toggle({ label, v, on }: { label: string; v: boolean; on: (b: boolean) => void }) {
  return (
    <button type="button" onClick={() => on(!v)}
      className={`p-3 border text-xs font-mono uppercase tracking-widest text-left ${v ? "border-lime2 text-lime2" : "border-silver/30 text-silver"}`}>
      <div>{label}</div><div className="mt-1 font-display text-xl">{v ? "YES" : "NO"}</div>
    </button>
  );
}
