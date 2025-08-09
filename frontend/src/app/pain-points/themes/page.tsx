"use client";
import React, { useEffect, useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection } from "@/types/excel";

type ThemeMapRes = { columns: string[]; rows: Array<Record<string, string>> };

export default function PainPointThemesPage() {
  const [excel, setExcel] = useState<StructuredExcelSelection>({ file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined });
  const [context, setContext] = useState<string>("");
  const [batch, setBatch] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThemeMapRes | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const canSubmit = !!excel.file && !!excel.idColumn && excel.textColumns.length > 0 && !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
  if (!excel.file) throw new Error("No file selected");
  fd.append("file", excel.file);
  fd.append("id_column", excel.idColumn || "");
  fd.append("text_columns", JSON.stringify(excel.textColumns));
      fd.append("additional_context", context);
      fd.append("batch_size", String(batch));
      if (excel.sheet) fd.append("sheet_name", excel.sheet);
      const res = await fetch("/api/ai/pain-points/themes/map", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as ThemeMapRes;
      setResult(json);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to generate themes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // Persist and restore selections per filename
  useEffect(() => {
    const key = excel.file ? `themes:${excel.file.name}` : null;
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const obj = JSON.parse(saved) as { idColumn?: string; textColumns?: string[] };
        setExcel(prev => ({ ...prev, idColumn: obj.idColumn ?? prev.idColumn, textColumns: obj.textColumns ?? prev.textColumns }));
      } catch {}
    }
  }, [excel.file]);

  useEffect(() => {
    const key = excel.file ? `themes:${excel.file.name}` : null;
    if (!key) return;
    localStorage.setItem(key, JSON.stringify({ idColumn: excel.idColumn, textColumns: excel.textColumns }));
  }, [excel.file, excel.idColumn, excel.textColumns]);

  async function downloadXlsx() {
    try {
      if (!excel.file) {
        setError("Select a file first");
        return;
      }
      setDownloading(true);
      setDownloadProgress(null);
      const fd = new FormData();
  fd.append("file", excel.file);
  fd.append("id_column", excel.idColumn || "");
  fd.append("text_columns", JSON.stringify(excel.textColumns));
      fd.append("additional_context", context);
  fd.append("batch_size", String(batch));
      if (excel.sheet) fd.append("sheet_name", excel.sheet);
      const res = await fetch("/api/ai/pain-points/themes/map.xlsx", { method: "POST", body: fd });
      if (!res.ok) { setError(`Download failed: HTTP ${res.status}`); return; }
      const total = Number(res.headers.get("content-length") || 0);
      if (res.body && total > 0) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
                      received += value.byteLength;
            setDownloadProgress(Math.round((received / total) * 100));
          }
        }
  const blob = new Blob(chunks.map(c => c as BlobPart), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
  a.href = url; a.download = "theme_perspective_mapping.xlsx"; a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "theme_perspective_mapping.xlsx"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Download failed";
      setError(message);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  return (
  <main className="min-h-screen p-4 bg-gradient-to-b from-zinc-950 to-neutral-900">
      <div className="mx-auto max-w-[110rem] space-y-6">
        <h1 className="text-3xl font-bold">Theme & Perspective Mapping</h1>
  <p className="text-gray-400">Upload pain points (CSV/XLSX), pick the ID and text columns, then generate theme & perspective mappings.</p>

        <section className="space-y-4">
          <form onSubmit={onSubmit} className="space-y-4">
            <ExcelDataInput mode="id-text" value={excel} onChange={setExcel} />
            {excel.headers.length > 0 && (
              <div className="grid md:grid-cols-3 gap-4 items-start">
                <div className="space-y-2 md:col-span-2">
                  <label className="block text-sm">Additional context</label>
                  <textarea className="w-full h-24 p-2 border rounded bg-black/20" value={context} onChange={(e) => setContext(e.target.value)} placeholder="Optional guidance for thematic nuance" />
                  <div className="flex flex-wrap items-end gap-6">
                    <div>
                      <label className="block text-sm">Batch size</label>
                      <input type="number" min={1} className="w-32 p-2 border rounded bg-black/20" value={batch} onChange={(e) => setBatch(parseInt(e.target.value || "10", 10))} />
                    </div>
                    <div className="flex gap-2">
                      <button disabled={!canSubmit || downloading} className="px-4 py-2 bg-green-600 rounded disabled:opacity-50">
                        {loading ? "Generating..." : "Generate mappings"}
                      </button>
                      <button type="button" className="px-4 py-2 bg-black/40 rounded border" onClick={() => { setExcel(prev => ({ ...prev, idColumn: undefined, textColumns: [] })); setResult(null); setError(null); }}>
                        Reset
                      </button>
                      <button type="button" className="px-4 py-2 bg-emerald-600 rounded disabled:opacity-50" onClick={downloadXlsx} disabled={!excel.file || !excel.idColumn || excel.textColumns.length === 0 || downloading}>
                        {downloading ? (downloadProgress === null ? "Downloading…" : `Downloading ${downloadProgress}%`) : "Download XLSX"}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-300">Reference Lists</h3>
                  <p className="text-xs text-gray-500">Predefined themes & perspectives are applied server-side (see spec). Future enhancement: fetch dynamic lists.</p>
                </div>
              </div>
            )}
          </form>
        </section>

        {result && result.rows?.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Results</h2>
              <span className="text-sm text-gray-400">{result.rows.length} rows</span>
            </div>
            <div className="overflow-auto border rounded-xl">
              <table className="min-w-full text-sm">
                <thead className="bg-black/40 sticky top-0">
                  <tr>
                    {result.columns.map((c) => (
                      <th key={c} className="p-2 text-left">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, idx) => (
                    <tr key={idx} className="odd:bg-white/5">
                      {result.columns.map((c) => (
                        <td key={c} className="p-2 align-top">{r[c] ?? ""}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
