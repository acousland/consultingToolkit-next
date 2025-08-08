import Link from "next/link";

export default function PainPointToolkit() {
  const links = [
    { href: "/pain-points", label: "Pain Point Extraction", emoji: "🧩" },
    { href: "/pain-points/themes", label: "Theme & Perspective Mapping", emoji: "🗂️" },
  { href: "/pain-points/impact", label: "Pain Point Impact Estimation", emoji: "📈" },
  { href: "/pain-points/capabilities", label: "Capability Mapping", emoji: "🧭" },
  ];
  return (
    <main>
      <div className="mx-auto max-w-5xl">
        <h1 className="text-3xl font-bold mb-1">🔍 Pain Point Toolkit</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-6">Identify, categorise, and map organisational challenges.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {links.map((l)=> (
            <Link href={l.href} key={l.label} className="group relative rounded-2xl p-[1.5px] bg-gradient-to-br from-indigo-500/40 to-violet-500/40 transition-all hover:from-indigo-500 hover:to-violet-500 hover:scale-[1.01]">
              <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-sm p-4">
                <div className="text-lg">{l.emoji} <span className="font-medium">{l.label}</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
