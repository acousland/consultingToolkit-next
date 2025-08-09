import Link from "next/link";

export default function Home() {
  const cards = [
    { title: "Pain Point Toolkit", emoji: "🔍", desc: "Identify, categorise, and map organisational challenges.", href: "/toolkits/pain-points", cta: "Open", badge: "New" },
    { title: "Capability Toolkit", emoji: "📝", desc: "Design and refine organisational capabilities.", href: "/toolkits/capabilities", cta: "Open" },
    { title: "Applications Toolkit", emoji: "🏗️", desc: "Map and analyse the technology landscape.", href: "/toolkits/applications", cta: "Open" },
    { title: "Data, Information, and AI", emoji: "📊", desc: "Design data models, information architecture, and AI solutions.", href: "/toolkits/data-ai", cta: "Open" },
    { title: "Engagement Planning", emoji: "📅", desc: "Plan and structure client engagements.", href: "/toolkits/engagement", cta: "Open" },
    { title: "Strategy & Motivations", emoji: "🎯", desc: "Align strategies with organisational capabilities.", href: "/toolkits/strategy", cta: "Open" },
  ];

  return (
    <main>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 p-10 md:p-14 mb-10">
        {/* Gradient backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/25 to-violet-500/25 blur-3xl" />
          <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-500/25 to-emerald-500/25 blur-3xl" />
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 via-violet-700 to-rose-600 dark:from-indigo-300 dark:via-violet-300 dark:to-rose-300">
          Consulting Toolkit
        </h1>
        <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 mt-3 max-w-2xl">
          An AI‑assisted workspace to surface organisational pain points, group them into themes, map capabilities & applications, plan engagements, align strategy, and accelerate data / information / AI solution design.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/toolkits/pain-points" className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:opacity-95">
            Get Started
          </Link>
          <Link href="/admin" className="px-5 py-2.5 rounded-xl border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10">
            Admin & Testing
          </Link>
        </div>
      </div>

      {/* Toolkits - Spotlight grid */}
      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <Link href={c.href} key={c.title} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/40 to-violet-500/40 transition-all duration-300 hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.01]] focus:outline-none focus:ring-2 focus:ring-indigo-500/60">
            <div className="relative h-full rounded-2xl bg-white/60 dark:bg-black/50 backdrop-blur-sm border border-black/10 dark:border-white/10 p-5 overflow-hidden">
              {/* Subtle top light */}
              <div className="pointer-events-none absolute -top-24 left-1/2 h-52 w-72 -translate-x-1/2 rounded-full bg-white/40 dark:bg-white/10 blur-2xl" />
              <div className="flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm">
                  <span className="text-xl">{c.emoji}</span>
                </span>
                {c.badge && (
                  <span className="text-[11px] uppercase tracking-wider rounded-full px-2 py-1 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 border border-emerald-600/20">
                    {c.badge}
                  </span>
                )}
              </div>
              <h2 className="mt-4 text-xl font-semibold">{c.title}</h2>
              <p className="text-gray-700/80 dark:text-gray-300/90 mt-1 mb-4 min-h-[3.5rem]">{c.desc}</p>
              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black/90 text-white dark:bg-white dark:text-black group-hover:translate-y-[-1px] transition">
                {c.cta}
                <svg className="h-4 w-4 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
              </span>
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
