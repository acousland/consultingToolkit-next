import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function SecondaryButton({ className = "", children, ...rest }: Props) {
  return (
    <button
      className={["rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition", className].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
