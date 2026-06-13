const steps = [
  ["Client creates task contract", "Defines task description, acceptance criteria, before/after image requirements, deadline."],
  ["Worker accepts terms", "Worker connects injected wallet and accepts task. Acceptance is recorded."],
  ["Worker uploads before/after images", "Browser computes SHA-256 hashes of each image and a metadata summary."],
  ["App creates proof envelope", "ProofEnvelope binds contract, task, submitter, hashes, claim, timestamp, nonce."],
  ["Worker signs proof envelope", "EIP-712 typed-data signature attributes submission to the worker wallet."],
  ["Proof commitment is submitted", "Envelope hash and image hash bundle are written to CertaFrameVerifier."],
  ["GenLayer reviews visual evidence", "Validators interpret task vs. images and converge on a structured verdict."],
  ["Contract stores structured verdict", "Outcome, continuity, completion, action are stored on-chain."],
  ["UI maps verdict to action", "Action Gate shows confirm milestone / request revision / dispute / escalate."],
];

export default function Page() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      <span className="section-label">How CertaFrame Works</span>
      <h1 className="font-display text-5xl text-optic mt-2 mb-2">Task Terms → Proof Capsule → Validator Lens → Action Gate</h1>
      <p className="text-silver mb-10 max-w-2xl">
        Hashes prove what was submitted. Signatures prove who submitted it. GenLayer judges whether the visual proof satisfies the task.
      </p>
      <ol className="space-y-3">
        {steps.map(([t, d], i) => (
          <li key={i} className="glass-panel flex gap-5">
            <span className="font-display text-3xl text-cyan2 min-w-[3rem]">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="font-head text-xl text-optic">{t}</h3>
              <p className="text-sm text-silver mt-1">{d}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
