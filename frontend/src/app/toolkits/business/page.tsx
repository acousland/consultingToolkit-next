import Link from "next/link";

export default function BusinessToolkit() {
  const links = [
    { href: "/pain-points", label: "Pain Point Cleanup", emoji: "🧩" },
    { href: "/pain-points/themes", label: "Theme & Perspective Mapping", emoji: "🗂️" },
    { href: "/pain-points/impact", label: "Pain Point Impact Estimation", emoji: "📈" },
    { href: "/pain-points/capabilities", label: "Capability Mapping", emoji: "🧭" },
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
          <p className="text-lg md:text-xl text-gray-300 mt-3 max-w-2xl">Identify, categorise, and map organisational challenges and business opportunities.</p>
        </div>
        <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {links.map((l) => (
            <Link key={l.label} href={l.href} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/40 to-violet-500/40 hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.01] transition-all duration-300">
              <div className="relative h-full rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 p-5 overflow-hidden">
                <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/10 blur-2xl" />
                <div className="flex items-start justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                    <span className="text-xl">{l.emoji}</span>
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-semibold">{l.label}</h2>
                <span className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-xl bg-white text-black group-hover:translate-y-[-1px] transition">Open
                  <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                </span>
              </div>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}
