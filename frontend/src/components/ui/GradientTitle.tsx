import React from "react";

type Props = React.PropsWithChildren<{ className?: string }>;

export function GradientTitle({ children, className = "" }: Props) {
  return (
    <h1 className={["text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-emerald-300 to-cyan-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]", className].join(" ")}>{children}</h1>
  );
}
