"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

type Cell = string | number | boolean | null | undefined;
export interface ExcelSelection {
  file: File | null;
  sheet: string | null;
  headers: string[];
  preview: Cell[][]; // first few rows including header row
  headerRowIndex?: number; // zero-based
}

export function ExcelPicker({ onChange, accept = ".csv,.xls,.xlsx,.xlsm", className = "", highlightColumns }: {
  onChange: (sel: ExcelSelection) => void;
  accept?: string;
  className?: string;
  highlightColumns?: Record<string, "id" | "text">; // map header -> role to highlight columns in preview
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [preview, setPreview] = useState<Cell[][]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [data, setData] = useState<Cell[][]>([]);

  function parseWorkbook(wb: XLSX.WorkBook, initialSheet?: string) {
    const names = wb.SheetNames || [];
    setSheetNames(names);
    const sel = initialSheet && names.includes(initialSheet) ? initialSheet : names[0] || null;
    setSheet(sel || null);
    if (sel) {
      const ws = wb.Sheets[sel];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Cell[][];
      setData(rows);
      const idx = Math.min(headerRowIndex, Math.max(0, rows.length - 1));
      const hdr = (rows[idx] || []).map((h) => String(h));
      setHeaders(hdr);
      setPreview(rows.slice(idx, idx + 6));
    } else {
      setHeaders([]);
      setPreview([]);
      setData([]);
    }
  }

  async function handleFile(f: File) {
    setFile(f);
    setLoading(true);
    if (f.name.toLowerCase().endsWith(".csv")) {
      const text = await f.text();
      // Use XLSX parser to correctly handle quoted fields and commas
      const wb = XLSX.read(text, { type: "string" });
      const names = wb.SheetNames || ["CSV"];
      const sel = names[0] || "CSV";
      setSheetNames([sel]);
      setSheet(sel);
      const ws = wb.Sheets[sel];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Cell[][];
      setData(rows);
      const idx = Math.min(headerRowIndex, Math.max(0, rows.length - 1));
      const hdr = (rows[idx] || []).map((h) => String(h));
      setHeaders(hdr);
      setPreview(rows.slice(idx, idx + 6));
      setLoading(false);
      return;
    }
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    parseWorkbook(wb);
    setLoading(false);
  }

  async function onSheetChange(name: string) {
    setSheet(name);
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".csv")) return; // single sheet equivalent
    setLoading(true);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    parseWorkbook(wb, name);
    setLoading(false);
  }

  // Recompute headers/preview when header row index changes without re-reading the file
  useEffect(() => {
    if (!data || data.length === 0) return;
    const idx = Math.min(headerRowIndex, Math.max(0, data.length - 1));
    const hdr = (data[idx] || []).map((h) => String(h));
    setHeaders(hdr);
    setPreview(data.slice(idx, idx + 6));
  }, [headerRowIndex, data]);

  useEffect(() => {
    onChange({ file, sheet, headers, preview, headerRowIndex });
  }, [file, sheet, headers, preview, headerRowIndex, onChange]);

  const fileName = useMemo(() => (file ? file.name : "No file selected"), [file]);

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f); }} />
  <div
    className="relative border-2 border-dashed border-white/10 rounded-xl p-4 hover:border-white/30 transition cursor-pointer bg-zinc-900/40"
    // Only trigger file dialog when clicking the empty backdrop (not when adjusting inputs/selects)
    onClick={(e)=>{ if (e.target === e.currentTarget) { inputRef.current?.click(); } }}
        onDragOver={(e)=>{e.preventDefault();}}
        onDrop={(e)=>{e.preventDefault(); const f=e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded" onClick={(e)=>{e.stopPropagation(); inputRef.current?.click();}}>Choose file</button>
          <span className="text-sm text-gray-300 truncate max-w-[60%]" title={fileName}>{fileName}</span>
          {sheetNames.length > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <label className="text-sm font-medium">Sheet</label>
      <select className="p-2 border rounded bg-zinc-900/60" value={sheet || ""} onClick={(e)=>e.stopPropagation()} onChange={(e)=>onSheetChange(e.target.value)} disabled={loading}>
                {sheetNames.map((n)=> (<option key={n} value={n}>{n}</option>))}
              </select>
            </div>
          )}
          {preview.length > 0 && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Header row</label>
      <input type="number" min={1} className="w-20 p-2 border rounded bg-zinc-900/60" value={headerRowIndex+1} disabled={loading} onClick={(e)=>e.stopPropagation()} onChange={(e)=>{
                const v = Math.max(1, parseInt(e.target.value||"1",10));
                setHeaderRowIndex(v-1);
              }} />
            </div>
          )}
        </div>
        {loading && (
          <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm flex items-center justify-center rounded-xl">
            <div className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Preview (first 5 rows from header)</div>
      <div className="overflow-auto border border-white/10 rounded-xl max-h-96">
              <table className="min-w-full text-xs">
        <thead className="sticky top-0 bg-zinc-900/80 backdrop-blur">
                  <tr>
                    {preview[0]?.map((cell,i)=>{
                      const head = String(cell ?? "");
                      const role = highlightColumns?.[head];
            const cls = role === "id" ? "bg-blue-600/30" : role === "text" ? "bg-purple-600/30" : "";
                      return (<th key={i} className={`p-2 border-b text-left font-semibold ${cls}`}>{head}</th>);
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(1).map((row, idx) => (
          <tr key={idx} className="odd:bg-zinc-900/30">
                      {row.map((cell,i)=>{
                        const head = String(preview[0]?.[i] ?? "");
                        const role = highlightColumns?.[head];
            const cls = role === "id" ? "bg-blue-600/10" : role === "text" ? "bg-purple-600/10" : "";
                        return (<td key={i} className={`p-2 border-b align-top whitespace-pre-wrap ${cls}`}>{String(cell ?? "")}</td>);
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
      <div className="text-sm text-gray-400 mb-1">Detected headers</div>
            <div className="flex flex-wrap gap-2">
              {headers.map((h)=> (
        <span key={h} className="px-2 py-1 rounded-full border border-white/10 bg-zinc-900/50">{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
