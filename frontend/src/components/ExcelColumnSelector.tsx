"use client";
import { useMemo } from "react";

export type ColumnSelectorMode = "id-text" | "single-text" | "multi-text";

export interface IdTextValue { idColumn: string; textColumns: string[] }
export interface TextValue { textColumns: string[] }

interface BaseProps<M extends ColumnSelectorMode, V> {
  mode: M;
  headers: string[];
  value: V;
  onChange: (v: V) => void;
  className?: string;
  labels?: Partial<{ id: string; text: string; single: string; multi: string; helper: string }>;
  required?: boolean;
}

type Props =
  | (BaseProps<"id-text", IdTextValue>)
  | (BaseProps<"single-text", TextValue>)
  | (BaseProps<"multi-text", TextValue>);

export function ExcelColumnSelector(props: Props) {
  const { mode, headers, className, required, labels } = props;
  const idVal = (props.mode === "id-text" ? props.value.idColumn : undefined);
  const textVals = useMemo(() => props.mode === "id-text" ? props.value.textColumns : props.value.textColumns, [props]);

  function toggleText(col: string) {
    if (mode === "single-text") {
      (props.onChange as any)({ textColumns: [col] });
      return;
    }
    const current = textVals;
    const next = current.includes(col) ? current.filter(c => c !== col) : [...current, col];
    (props.onChange as any)(mode === "id-text" ? { idColumn: idVal || "", textColumns: next } : { textColumns: next });
  }

  function setId(col: string) {
    if (mode === "id-text") {
      (props.onChange as any)({ idColumn: col, textColumns: textVals });
    }
  }

  const hasSelection = textVals.length > 0 || (idVal ?? "") !== "";

  return (
    <div className={className}>
      {mode === "id-text" && (
        <div className="space-y-1 mb-4">
          <label className="block text-sm font-medium">{labels?.id || "ID column"}{required && <span className="text-red-600 ml-1">*</span>}</label>
          <div className="flex flex-wrap gap-2">
            {headers.map(h => (
              <button
                type="button"
                key={h}
                onClick={() => setId(h)}
                className={`px-2 py-1 rounded border text-xs transition ${idVal === h ? "bg-blue-600 text-white border-blue-600" : "bg-white/50 dark:bg-black/40 border-black/10 dark:border-white/10 hover:border-blue-400"}`}
              >{h}</button>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {mode === "single-text" ? (labels?.single || "Data column") : (labels?.text || (mode === "id-text" ? "Text columns" : "Columns"))}
          {(required && !hasSelection) && <span className="text-red-600 ml-1">*</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {headers.map(h => {
            const active = mode === "single-text" ? textVals[0] === h : textVals.includes(h);
            return (
              <button
                type="button"
                key={h}
                onClick={() => toggleText(h)}
                className={`px-2 py-1 rounded border text-xs transition ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white/50 dark:bg-black/40 border-black/10 dark:border-white/10 hover:border-indigo-400"}`}
              >{h}</button>
            );
          })}
        </div>
        {labels?.helper && <p className="text-xs text-gray-500 mt-1">{labels.helper}</p>}
      </div>
    </div>
  );
}
