import Link from "next/link";

export const metadata = {
  title: "Getting Started | Consulting Toolkit",
  description: "Overview and first steps for using the Consulting Toolkit",
};

export default function GettingStartedPage() {
  const steps = [
    {
      title: "1. Gather raw inputs",
      body: "Export pain points, capability lists, application inventories, or use case ideas from existing spreadsheets / trackers.",
    },
    {
      title: "2. Clean & structure",
      body: "Use the Business Toolkit to normalise, deduplicate, and chunk long text. Pick ID + text columns with the Excel input component.",
    },
    {
      title: "3. Generate insights",
      body: "Map themes, capabilities, impacts, strategies, data models—each tool produces tabular results and optional XLSX downloads.",
    },
    {
      title: "4. Iterate & refine",
      body: "Adjust additional context, batch sizes, or prompts (future) to refine outputs. Re-upload improved spreadsheets seamlessly.",
    },
    {
      title: "5. Export & share",
      body: "Download XLSX artefacts for inclusion in decks, backlog systems, or architecture repositories.",
    },
  ];

  const toolkits = [
    { href: "/toolkits/business", label: "Business Toolkit", desc: "Structured extraction, theming, capability & impact mapping." },
    { href: "/toolkits/business", label: "Business Toolkit", desc: "Comprehensive pain point analysis, capability management, and strategic alignment." },
    { href: "/toolkits/applications", label: "Applications Toolkit", desc: "Relate applications to capabilities & derive logical groupings." },
    { href: "/toolkits/data-ai", label: "Data, Information & AI", desc: "Conceptual data models, data→application mapping, AI use cases." },
    { href: "/toolkits/engagement", label: "Engagement Planning", desc: "Structure engagement touchpoints and artefacts." },

    { href: "/toolkits/intelligence", label: "Intelligence Toolkit", desc: "Analyze trends, insights, and intelligence patterns across organizational data." },
  ];

  return (
    <main className="space-y-12">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 p-10 md:p-14">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -right-20 h-72 w-72 rounded-full bg-gradient-to-tr from-sky-500/20 to-emerald-500/20 blur-3xl" />
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-violet-400 to-rose-300">
          Getting Started
        </h1>
        <p className="mt-4 text-lg max-w-3xl text-gray-300">
          The Consulting Toolkit accelerates early discovery & shaping: transforming raw lists of issues, systems, and ideas into structured artefacts—capabilities, themes, impacts, strategies, data models—that inform roadmaps and investment cases.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/toolkits/business" className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:opacity-95">
            Start with Business
          </Link>
          <Link href="/" className="px-5 py-2.5 rounded-xl border border-white/15 hover:bg-white/10">
            Home
          </Link>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2">
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Core workflow</h2>
          <ol className="space-y-4 list-decimal list-inside text-gray-300">
            {steps.map(s => (
              <li key={s.title} className="pl-1">
                <span className="font-medium text-white">{s.title}</span>
                <p className="text-sm mt-1 text-gray-400">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-4 p-4 rounded-xl bg-black/40 border border-white/10 text-sm text-gray-300">
            <strong>Tip:</strong> Column selections persist per filename, so iterative clean-up + reruns are frictionless.
          </div>
        </div>
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Toolkits overview</h2>
          <div className="space-y-4">
            {toolkits.map(t => (
              <Link key={t.href} href={t.href} className="block group p-4 rounded-lg border border-white/10 bg-black/40 hover:border-violet-500/40 transition">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium group-hover:text-violet-300">{t.label}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10">Open</span>
                </div>
                <p className="mt-1 text-xs text-gray-400 max-w-prose leading-relaxed">{t.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-semibold">Key concepts</h2>
        <div className="grid gap-5 md:grid-cols-2">
          {[{
            k: "Pain Point Normalisation",
            v: "Automated cleaning (case, whitespace), dedupe, optional chunking for long entries before thematic / capability analysis.",
          }, {
            k: "Themes & Perspectives",
            v: "Grouping related pain points to reveal systemic issues; perspectives add stakeholder or domain lenses.",
          }, {
            k: "Capabilities",
            v: "Stable building blocks describing what the organisation must be able to do—inputs to operating & investment models.",
          }, {
            k: "Impact Estimation",
            v: "Heuristic / AI scoring to prioritise remediation and investment focus areas.",
          }, {
            k: "Data & Conceptual Models",
            v: "Early logical framing of entities & relationships to align solution shaping across teams.",
          }, {
            k: "Strategy Alignment",
            v: "Linking strategic intents to enabling capabilities to expose gaps & sequencing needs.",
          }].map(c => (
            <div key={c.k} className="p-4 rounded-xl bg-black/40 border border-white/10">
              <h3 className="font-medium mb-1 text-violet-300">{c.k}</h3>
              <p className="text-xs text-gray-400 leading-relaxed">{c.v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">FAQ</h2>
        <div className="space-y-4 text-sm text-gray-300">
          <div>
            <h3 className="font-medium">Do I need an OpenAI key?</h3>
            <p className="text-gray-400">No. Without a key the backend falls back to deterministic heuristics—useful for structure validation and demos.</p>
          </div>
          <div>
            <h3 className="font-medium">Is my data stored?</h3>
            <p className="text-gray-400">Uploads are processed in-memory; no persistence layer is implemented. Add a storage service (S3, Postgres) if needed.</p>
          </div>
          <div>
            <h3 className="font-medium">Can I customise prompts?</h3>
            <p className="text-gray-400">Prompt override UI is on the roadmap—current prompts live server-side for consistency.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
