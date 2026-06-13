const examples = [
  { title: "Wall paint", task: "Paint the east-facing wall white and remove visible cracks before Friday.", criteria: ["Same wall in both images", "Complete white coverage", "No visible large cracks", "Similar angle"] },
  { title: "Signboard install", task: "Install branded signboard at marked entrance.", criteria: ["Signboard mounted at entrance", "Brand text legible", "Aligned to mounting marks"] },
  { title: "Event cleanup", task: "Clean main hall after the event.", criteria: ["Floors clear of debris", "Tables stacked or removed", "Bins emptied"] },
  { title: "Pipe repair", task: "Repair leaking pipe joint under sink.", criteria: ["Joint sealed", "No visible water", "Same fixture as before"] },
];

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto px-6 py-16">
      <span className="section-label">Examples</span>
      <h1 className="font-display text-5xl text-optic mt-2 mb-8">Illustrative proof contracts</h1>
      <div className="grid md:grid-cols-2 gap-5">
        {examples.map((e) => (
          <div key={e.title} className="glass-panel">
            <h3 className="font-head text-xl text-optic">{e.title}</h3>
            <p className="text-sm text-bone mt-2">{e.task}</p>
            <span className="section-label mt-4 block">Acceptance Criteria</span>
            <ul className="mt-2 space-y-1 text-sm text-silver">
              {e.criteria.map((c) => <li key={c} className="flex gap-2"><span className="text-lime2">▸</span>{c}</li>)}
            </ul>
          </div>
        ))}
      </div>
    </main>
  );
}
