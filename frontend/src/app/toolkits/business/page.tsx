import Link from "next/link";

export default function BusinessToolkit() {
  const painPointTools = [
    { href: "/pain-points/cleanup", label: "Pain Point Cleanup & Normalisation", emoji: "�", desc: "Refine raw pain points into high-quality canonical statements" },
    { href: "/pain-points/themes", label: "Theme & Perspective Mapping", emoji: "🗂️", desc: "Categorise pain points into themes and organisational perspectives" },
    { href: "/pain-points/impact", label: "Pain Point Impact Estimation", emoji: "�", desc: "Assess business impact of identified pain points" },
    { href: "/pain-points/capabilities", label: "Pain Point to Capability Mapping", emoji: "🎯", desc: "Map pain points to organisational capabilities" },
  ];

  const capabilityTools = [
    { href: "/capabilities/describe", label: "Capability Description Generator", emoji: "📝", desc: "Generate detailed capability descriptions and definitions" },
  ];

  const strategyTools = [
    { href: "/strategy/capabilities", label: "Strategy to Capability Mapping", emoji: "🧠", desc: "Map strategic initiatives to required capabilities" },
    { href: "/strategy/tactics", label: "Tactics to Strategies Generator", emoji: "�", desc: "Transform tactical activities into strategic initiatives" },
  ];
  return (
    <main>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-10 mb-8 bg-black/40">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 blur-3xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-300 via-violet-300 to-rose-300">Business Toolkit</h1>
          <p className="text-lg md:text-xl text-gray-300 mt-3 max-w-2xl">Comprehensive tools for pain point analysis, capability management, and strategic alignment.</p>
        </div>

        {/* Pain Point Analysis */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🔍 Pain Point Analysis</h2>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 mb-8">
            {painPointTools.map((tool) => (
              <Link key={tool.label} href={tool.href} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-red-500/40 to-orange-500/40 hover:from-red-500 hover:to-orange-500 hover:scale-[1.01] transition-all duration-300">
                <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-orange-600 text-white shadow-sm">
                      <span className="text-xl">{tool.emoji}</span>
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{tool.label}</h3>
                  <p className="text-gray-300 text-sm mt-2 mb-4">{tool.desc}</p>
                  <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                    <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </div>

        {/* Capability Management */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🎯 Capability Management</h2>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 mb-8">
            {capabilityTools.map((tool) => (
              <Link key={tool.label} href={tool.href} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-emerald-500/40 to-sky-500/40 hover:from-emerald-500 hover:to-sky-500 hover:scale-[1.01] transition-all duration-300">
                <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-sm">
                      <span className="text-xl">{tool.emoji}</span>
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{tool.label}</h3>
                  <p className="text-gray-300 text-sm mt-2 mb-4">{tool.desc}</p>
                  <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                    <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </div>

        {/* Strategic Alignment */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🧠 Strategic Alignment</h2>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {strategyTools.map((tool) => (
              <Link key={tool.label} href={tool.href} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-rose-500/40 to-purple-500/40 hover:from-rose-500 hover:to-purple-500 hover:scale-[1.01] transition-all duration-300">
                <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-600 to-purple-600 text-white shadow-sm">
                      <span className="text-xl">{tool.emoji}</span>
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{tool.label}</h3>
                  <p className="text-gray-300 text-sm mt-2 mb-4">{tool.desc}</p>
                  <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                    <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                  </span>
                </div>
              </Link>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
