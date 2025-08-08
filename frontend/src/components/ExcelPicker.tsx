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

export function ExcelPicker({ onChange, accept = ".csv,.xls,.xlsx,.xlsm", className = "" }: {
  onChange: (sel: ExcelSelection) => void;
  accept?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [sheet, setSheet] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(0);
  const [preview, setPreview] = useState<Cell[][]>([]);

  function parseWorkbook(wb: XLSX.WorkBook, initialSheet?: string) {
    const names = wb.SheetNames || [];
    setSheetNames(names);
    const sel = initialSheet && names.includes(initialSheet) ? initialSheet : names[0] || null;
    setSheet(sel || null);
    if (sel) {
      const ws = wb.Sheets[sel];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Cell[][];
  const idx = Math.min(headerRowIndex, Math.max(0, data.length - 1));
  const hdr = (data[idx] || []).map((h) => String(h));
  setHeaders(hdr);
  setPreview(data.slice(idx, idx + 6));
    } else {
      setHeaders([]);
      setPreview([]);
    }
  }

  async function handleFile(f: File) {
    setFile(f);
    if (f.name.toLowerCase().endsWith(".csv")) {
      const text = await f.text();
      // Use XLSX parser to correctly handle quoted fields and commas
      const wb = XLSX.read(text, { type: "string" });
      const names = wb.SheetNames || ["CSV"];
      const sel = names[0] || "CSV";
      setSheetNames([sel]);
      setSheet(sel);
      const ws = wb.Sheets[sel];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as Cell[][];
      const idx = Math.min(headerRowIndex, Math.max(0, data.length - 1));
      const hdr = (data[idx] || []).map((h) => String(h));
      setHeaders(hdr);
      setPreview(data.slice(idx, idx + 6));
      return;
    }
    const buf = await f.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    parseWorkbook(wb);
  }

  async function onSheetChange(name: string) {
    setSheet(name);
  if (!file) return;
    if (file.name.toLowerCase().endsWith(".csv")) return; // single sheet equivalent
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    parseWorkbook(wb, name);
  }

  useEffect(() => {
    onChange({ file, sheet, headers, preview, headerRowIndex });
  }, [file, sheet, headers, preview, headerRowIndex, onChange]);

  const fileName = useMemo(() => (file ? file.name : "No file selected"), [file]);

  return (
    <div className={className}>
      <input ref={inputRef} type="file" accept={accept} hidden onChange={(e)=>{ const f=e.target.files?.[0]; if (f) handleFile(f); }} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="px-4 py-2 bg-blue-600 text-white rounded" onClick={()=>inputRef.current?.click()}>Upload file</button>
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[60%]" title={fileName}>{fileName}</span>
        {sheetNames.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Sheet</label>
            <select className="p-2 border rounded" value={sheet || ""} onChange={(e)=>onSheetChange(e.target.value)}>
              {sheetNames.map((n)=> (<option key={n} value={n}>{n}</option>))}
            </select>
          </div>
        )}
        {preview.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Header row</label>
            <input type="number" min={1} className="w-20 p-2 border rounded" value={headerRowIndex+1} onChange={(e)=>{
              const v = Math.max(1, parseInt(e.target.value||"1",10));
              setHeaderRowIndex(v-1);
              // re-parse current sheet to update headers/preview
              if (file) {
                if (sheet === "CSV") {
                  handleFile(file);
                } else {
                  onSheetChange(sheet || "");
                }
              }
            }} />
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-1">Preview (first 5 rows from header)</div>
            <div className="overflow-auto border rounded max-h-96">
              <table className="min-w-full text-xs">
                <tbody>
                  {preview.map((row, idx) => (
                    <tr key={idx} className={idx===0? "bg-black/5 dark:bg-white/10 font-medium" : ""}>
                      {row.map((cell,i)=>(<td key={i} className="p-2 border-b align-top whitespace-pre-wrap">{String(cell ?? "")}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-1">Detected headers</div>
            <div className="flex flex-wrap gap-2">
              {headers.map((h)=> (
                <span key={h} className="px-2 py-1 rounded border bg-white dark:bg-black/40">{h}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
