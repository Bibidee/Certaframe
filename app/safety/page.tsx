export default function Page() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16 space-y-6">
      <span className="section-label">Safety & Scope</span>
      <h1 className="font-display text-5xl text-optic">What CertaFrame proves — and what it does not</h1>
      <div className="glass-panel">
        <p className="text-sm text-optic leading-relaxed">
          CertaFrame provides AI-consensus review of submitted visual evidence. It does not guarantee authenticity,
          legality, safety compliance, or full real-world completion outside the submitted evidence.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="glass-panel border-lime2/40">
          <span className="section-label">Cryptography proves</span>
          <ul className="mt-2 space-y-1 text-sm text-bone">
            <li>▸ submitted image bytes match recorded hash</li>
            <li>▸ proof packet was signed by worker wallet</li>
            <li>▸ proof belongs to a contract/task</li>
            <li>▸ envelope was not changed after signing</li>
            <li>▸ review result is linked to proof hash</li>
          </ul>
        </div>
        <div className="glass-panel border-magma/50">
          <span className="section-label" style={{ color: "var(--magma)" }}>Cryptography does NOT prove</span>
          <ul className="mt-2 space-y-1 text-sm text-bone">
            <li>▸ image is truthful</li>
            <li>▸ image was taken at claimed place</li>
            <li>▸ image was not staged</li>
            <li>▸ work was safe or legal</li>
            <li>▸ task was fully complete outside camera frame</li>
          </ul>
        </div>
      </div>
      <div className="glass-panel border-amber2/50">
        <span className="section-label" style={{ color: "var(--amber2)" }}>High-risk domains</span>
        <p className="mt-2 text-sm text-bone">
          Do not use CertaFrame as the only inspection mechanism for safety-critical work, regulated compliance,
          medical evidence, law enforcement, or structural engineering certification.
        </p>
      </div>
    </main>
  );
}
