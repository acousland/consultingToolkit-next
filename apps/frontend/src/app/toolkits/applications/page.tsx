export default function ApplicationsToolkit() {
  const currentStateTools = [
    { href: "/applications/capabilities", label: "Application → Capability Mapping", disabled: false, emoji: "🔗" },
    { href: "/applications/logical-model", label: "Logical Application Model Generator", disabled: false, emoji: "🧱" },
    { href: "/applications/map", label: "Individual Application Mapping", disabled: false, emoji: "🧩" },
    { href: "/applications/physical-logical", label: "Physical → Logical Application Mapping", disabled: false, emoji: "🧬" },
  ];

  const futureStateTools = [
    { href: "/applications/future-portfolio", label: "Future State Application Portfolio Generator", disabled: false, emoji: "🚀" },
  ];

  return (
    <main>
      <div className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 p-8 md:p-10 mb-8 bg-black/40">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-amber-500/20 to-pink-500/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-fuchsia-500/20 to-sky-500/20 blur-3xl" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-pink-300 to-fuchsia-300">Applications Toolkit</h1>
          <p className="text-lg md:text-xl text-gray-300 mt-3 max-w-2xl">Plan and model your application landscape.</p>
        </div>

        {/* Current State Analysis */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">📊 Current State Analysis</h2>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {currentStateTools.map((tool) => (
              <a key={tool.label} href={tool.href} className={`group relative rounded-2xl p-[1.5px] ${tool.disabled ? 'opacity-60 cursor-not-allowed' : 'bg-gradient-to-br from-amber-500/40 to-pink-500/40 hover:from-amber-500 hover:to-pink-500 hover:scale-[1.01] transition-all duration-300'}`}>
                <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-600 to-pink-600 text-white shadow-sm">
                      <span className="text-xl">{tool.emoji}</span>
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{tool.label}</h3>
                  <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                    <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                  </span>
                </div>
              </a>
            ))}
          </section>
        </div>

        {/* Future State Planning */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white mb-4">🚀 Future State Planning</h2>
          <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {futureStateTools.map((tool) => (
              <a key={tool.label} href={tool.href} className={`group relative rounded-2xl p-[1.5px] ${tool.disabled ? 'opacity-60 cursor-not-allowed' : 'bg-gradient-to-br from-emerald-500/40 to-cyan-500/40 hover:from-emerald-500 hover:to-cyan-500 hover:scale-[1.01] transition-all duration-300'}`}>
                <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                  <div className="flex items-start justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-cyan-600 text-white shadow-sm">
                      <span className="text-xl">{tool.emoji}</span>
                    </span>
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{tool.label}</h3>
                  <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                    <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                  </span>
                </div>
              </a>
            ))}
          </section>
        </div>
      </div>
    </main>
  );
}
