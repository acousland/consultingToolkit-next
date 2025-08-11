import Link from "next/link";

export default function IntelligenceToolkit() {
  const links = [
    // Placeholder - will be populated with actual tools later
    { href: "#", label: "Coming Soon", disabled: true, emoji: "🧠" },
  ];

  return (
    <main>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-10 mb-8 bg-black/40">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-blue-500/20 to-teal-500/20 blur-3xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-300 via-blue-300 to-cyan-300">Intelligence Toolkit</h1>
          <p className="text-lg md:text-xl text-gray-300 mt-3 max-w-2xl">Analyze trends, insights, and intelligence patterns across organizational data.</p>
        </div>
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((l) => (
            <a key={l.label} href={l.href} className={`group relative rounded-2xl p-[1.5px] ${l.disabled ? 'opacity-60 cursor-not-allowed' : 'bg-gradient-to-br from-purple-500/40 to-cyan-500/40 hover:from-purple-500 hover:to-cyan-500 hover:scale-[1.01] transition-all duration-300'}`}>
              <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-cyan-600 text-white shadow-sm">
                    <span className="text-xl">{l.emoji}</span>
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{l.label}</h2>
                <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">
                  {l.disabled ? 'Coming Soon' : 'Open'}
                  <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                </span>
              </div>
            </a>
          ))}
        </section>
      </div>
    </main>
  );
}
