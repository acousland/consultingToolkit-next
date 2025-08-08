export default function Home() {
  const cards = [
    {
      title: "Pain Point Toolkit",
      emoji: "🔍",
      desc: "Identify, categorise, and map organisational challenges.",
      href: "/toolkits/pain-points",
      cta: "Open"
    },
    {
      title: "Capability Toolkit",
      emoji: "📝",
      desc: "Design and refine organisational capabilities.",
      href: "/toolkits/capabilities",
      cta: "Open"
    },
    {
      title: "Applications Toolkit",
      emoji: "🏗️",
      desc: "Map and analyse the technology landscape.",
      href: "/toolkits/applications",
      cta: "Open"
    },
    {
      title: "Data, Information, and AI",
      emoji: "📊",
      desc: "Design data models, information architecture, and AI solutions.",
      href: "/toolkits/data-ai",
      cta: "Open"
    },
    {
      title: "Engagement Planning",
      emoji: "📅",
      desc: "Plan and structure client engagements.",
      href: "/toolkits/engagement",
      cta: "Open"
    },
    {
      title: "Strategy & Motivations",
      emoji: "🎯",
      desc: "Align strategies with organisational capabilities.",
      href: "/toolkits/strategy",
      cta: "Open"
    }
  ];

  return (
    <main>
      <div className="relative overflow-hidden rounded-2xl border border-black/10 dark:border-white/10 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/20 p-8 mb-8">
        <h1 className="text-4xl font-bold">Consulting Toolkit</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2 max-w-2xl">A modern toolkit for pain-point analysis, capability mapping, engagement planning, and strategy—powered by a FastAPI backend.</p>
        <div className="mt-4">
          <a href="/toolkits/pain-points" className="inline-block px-4 py-2 rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:opacity-95">Get Started</a>
        </div>
        <span className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl" />
      </div>

      <section className="grid gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="border rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow">
              <div className="text-2xl">{c.emoji}</div>
              <h2 className="mt-2 text-xl font-semibold">{c.title}</h2>
              <p className="text-gray-600 dark:text-gray-300 mt-1 flex-1">{c.desc}</p>
              <a href={c.href} className="mt-4 inline-block px-4 py-2 rounded-md bg-gray-900 dark:bg-white text-white dark:text-black w-fit">{c.cta}</a>
            </div>
          ))}
      </section>

      <div className="mt-10">
        <a href="/admin" className="text-sm text-blue-700 dark:text-blue-400 underline">Admin & Testing</a>
      </div>
    </main>
  );
}
