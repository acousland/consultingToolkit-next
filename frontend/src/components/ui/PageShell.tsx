import React from "react";

type Props = React.PropsWithChildren<{ className?: string; max?: "7xl" | "2xl" | "full" }>;

export function PageShell({ children, className = "", max = "2xl" }: Props) {
  const maxClass = max === "full" ? "max-w-none" : max === "7xl" ? "max-w-7xl" : "max-w-screen-2xl";
  return (
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-slate-100">
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
        <div className="absolute -top-32 -left-32 h-96 w-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>
      <div className={["mx-auto relative z-10", maxClass, "px-6 py-10 space-y-10", className].join(" ")}>{children}</div>
    </main>
  );
}
