import React from "react";

type GlassCardProps = React.PropsWithChildren<{
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  innerHairline?: boolean;
}>;

export function GlassCard({ className = "", padding = "lg", innerHairline = false, children }: GlassCardProps) {
  const pad = padding === "none" ? "" : padding === "sm" ? "p-4" : padding === "md" ? "p-6" : "p-8";
  return (
    <div className={["rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.4),0_10px_40px_-2px_rgba(0,0,0,0.35)]", pad, className].join(" ")}> 
      {innerHairline ? (
        <div className="relative">
          {children}
          <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
        </div>
      ) : children}
    </div>
  );
}
