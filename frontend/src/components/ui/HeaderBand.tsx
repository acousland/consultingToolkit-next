import React from "react";

type Props = { label: string; className?: string };

export function HeaderBand({ label, className = "" }: Props) {
  return (
    <div className={["inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 backdrop-blur-sm text-xs uppercase tracking-wider text-fuchsia-300/80", className].join(" ")}> 
      <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
      {label}
    </div>
  );
}
