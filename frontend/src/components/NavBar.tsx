"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

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
  const [isElectron, setIsElectron] = useState(false);
  
  useEffect(() => {
    // Check if we're running in Electron
    setIsElectron(typeof window !== 'undefined' && window.navigator.userAgent.includes('Electron'));
  }, []);
  
  return (
    <header className="sticky top-0 z-40 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10">
      {/* Draggable area for Electron - includes the header background */}
      <div className={`${isElectron ? 'h-6' : 'h-0'} electron-header-spacer bg-transparent electron-drag w-full`} />
      <nav className={`mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between electron-drag electron-header-nav ${isElectron ? 'pl-20' : ''}`}>
        <div className="flex items-center gap-3 electron-no-drag">
          <Link href="/" className="flex items-center gap-2" aria-label="Consulting Toolkit Home">
            <img src="/ct-logo.svg" alt="Consulting Toolkit" className="h-7 w-7" />
            <span className="text-sm sm:text-base font-semibold">Consulting Toolkit</span>
          </Link>
        </div>
        <div className="hidden md:flex items-center gap-1 electron-no-drag">
          <NavLink href="/" label="Home" />
                    <NavLink href="/toolkits/business" label="Business" />
          <NavLink href="/toolkits/applications" label="Applications" />
          <NavLink href="/toolkits/data-ai" label="Data & AI" />
          <NavLink href="/toolkits/engagement" label="Engagement" />
          <NavLink href="/toolkits/intelligence" label="Intelligence" />
        </div>
        <div className="flex items-center gap-2 electron-no-drag">
            <Link href="/admin" className="px-3 py-1.5 text-sm rounded-md border border-white/10 hover:bg-white/10">Admin</Link>
            <Link href="/getting-started" className="px-3 py-1.5 text-sm rounded-md bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow hover:opacity-95">Get Started</Link>
        </div>
      </nav>
    </header>
  );
}