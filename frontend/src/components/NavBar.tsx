"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
        active ? "bg-black/10 dark:bg-white/10" : ""
      }`}
    >
      {label}
    </Link>
  );
}

export default function NavBar() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-7 w-7 rounded bg-gradient-to-br from-indigo-500 to-violet-600" />
            <span className="text-sm sm:text-base font-semibold">Consulting Toolkit</span>
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-1">
          <NavLink href="/" label="Home" />
          <NavLink href="/toolkits/business" label="Business" />
          <NavLink href="/toolkits/capabilities" label="Capabilities" />
          <NavLink href="/toolkits/applications" label="Applications" />
          <NavLink href="/toolkits/data-ai" label="Data & AI" />
          <NavLink href="/toolkits/engagement" label="Engagement" />
          <NavLink href="/toolkits/strategy" label="Strategy" />
          <NavLink href="/toolkits/intelligence" label="Intelligence" />
        </div>
        <div className="flex items-center gap-2">
            <Link href="/admin" className="px-3 py-1.5 text-sm rounded-md border border-white/10 hover:bg-white/10">Admin</Link>
            <Link href="/getting-started" className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:opacity-95">Get Started</Link>
        </div>
      </nav>
    </header>
  );
}
