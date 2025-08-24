import React from "react";

type Variant = "neutral" | "warning" | "success" | "info";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
};

const styles: Record<Variant, string> = {
  neutral: "bg-white/5 border-white/10 text-slate-200",
  warning: "bg-amber-400/20 border-amber-300/20 text-amber-100",
  success: "bg-emerald-400/20 border-emerald-300/20 text-emerald-100",
  info: "bg-cyan-400/20 border-cyan-300/20 text-cyan-100",
};

export function StatusPill({ children, variant = "neutral", className = "" }: Props) {
  return (
    <span className={["text-[11px] px-2 py-1 rounded border", styles[variant], className].join(" ")}>{children}</span>
  );
}
