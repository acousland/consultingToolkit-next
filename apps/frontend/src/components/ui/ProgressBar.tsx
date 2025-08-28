import React from "react";

type Props = { value: number; className?: string };

export function ProgressBar({ value, className = "" }: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={["h-2 rounded-full bg-white/5 overflow-hidden", className].join(" ")}> 
      <div className="h-full bg-gradient-to-r from-fuchsia-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}
