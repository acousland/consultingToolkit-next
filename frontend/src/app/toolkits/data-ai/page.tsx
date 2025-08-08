export default function DataAIToolkit() {
  const links = [
    { href: "#", label: "Conceptual Data Model Generator (coming soon)", disabled: true, emoji: "🧬" },
    { href: "#", label: "Data-Application Mapping (coming soon)", disabled: true, emoji: "🗺️" },
    { href: "#", label: "AI Use Case Customiser (coming soon)", disabled: true, emoji: "🤖" },
    { href: "/", label: "Use Case Ethics Review (demo on home previously)", disabled: false, emoji: "⚖️" },
  ];
  return (
    <main>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-1">📊 Data, Information, and AI Toolkit</h1>
        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          {links.map((l)=> (
            l.disabled ? (
              <div key={l.label} className="opacity-60 cursor-not-allowed relative rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/20 to-violet-500/20">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-sm p-4">
                  <div className="text-lg">{l.emoji} <span className="font-medium">{l.label}</span></div>
                </div>
              </div>
            ) : (
              <a key={l.label} href={l.href} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/40 to-violet-500/40 transition-all hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.01]">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-sm p-4">
                  <div className="text-lg">{l.emoji} <span className="font-medium">{l.label}</span></div>
                </div>
              </a>
            )
          ))}
        </div>
      </div>
    </main>
  );
}
