import React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  icon?: React.ReactNode;
};

export function PrimaryButton({ loading, icon, className = "", children, ...rest }: Props) {
  return (
    <button
      className={["relative overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-emerald-500 px-6 py-3 text-sm font-semibold tracking-wide text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed", className].join(" ")}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          Loading...
        </span>
      ) : (
        <span className="flex items-center gap-2">{icon}{children}</span>
      )}
    </button>
  );
}
