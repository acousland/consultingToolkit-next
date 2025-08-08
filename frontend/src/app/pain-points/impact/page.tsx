"use client";
import { useState } from "react";
import { ExcelPicker, type ExcelSelection } from "@/components/ExcelPicker";

interface ImpactRes {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export default function ImpactEstimation() {
  const [idCol, setIdCol] = useState("");
  const [textCols, setTextCols] = useState("");
  const [context, setContext] = useState("");
  const [batch, setBatch] = useState(15);
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImpactRes | null>(null);
  const [excel, setExcel] = useState<ExcelSelection>({ file: null, sheet: null, headers: [], preview: [] });
  const [selectedCols, setSelectedCols] = useState<string[]>([]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setResult(null);
  if (!excel.file) { setError("Select a file"); setLoading(false); return; }
    const fd = new FormData();
  fd.append("file", excel.file);
    fd.append("id_column", idCol);
  fd.append("text_columns", JSON.stringify((selectedCols.length? selectedCols : textCols.split(",").map(s=>s.trim()).filter(Boolean))));
    fd.append("additional_context", context);
    fd.append("batch_size", String(batch));
  if (excel.sheet || sheet) fd.append("sheet_name", excel.sheet || sheet);
    const res = await fetch("/api/ai/pain-points/impact/estimate", { method: "POST", body: fd });
    if (!res.ok) { setError(`HTTP ${res.status}`); setLoading(false); return; }
    const json = (await res.json()) as ImpactRes;
    setResult(json);
    setLoading(false);
  }

  async function downloadXlsx() {
  if (!excel.file) { setError("Select a file first"); return; }
    const fd = new FormData();
  fd.append("file", excel.file);
    fd.append("id_column", idCol);
  fd.append("text_columns", JSON.stringify((selectedCols.length? selectedCols : textCols.split(",").map(s=>s.trim()).filter(Boolean))));
    fd.append("additional_context", context);
    fd.append("batch_size", String(batch));
  if (excel.sheet || sheet) fd.append("sheet_name", excel.sheet || sheet);
    const res = await fetch("/api/ai/pain-points/impact/estimate.xlsx", { method: "POST", body: fd });
    if (!res.ok) { setError(`Download failed: HTTP ${res.status}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pain_point_impact_estimate.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Impact Estimation</h1>
        <p className="text-gray-600">Upload pain points, pick the ID and text columns, and get impact scores per pain point.</p>

        <form id="impact-form" className="grid md:grid-cols-2 gap-6" onSubmit={onSubmit}>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Upload CSV/XLSX</label>
            <ExcelPicker onChange={setExcel} />
            <label className="block text-sm font-medium">Pain Point ID column</label>
            <input type="text" className="w-full p-2 border rounded" value={idCol} onChange={e=>setIdCol(e.target.value)} placeholder="e.g. Pain_Point_ID" />
            <label className="block text-sm font-medium">Text columns (comma-separated)</label>
            <input type="text" className="w-full p-2 border rounded" value={textCols} onChange={e=>setTextCols(e.target.value)} placeholder="e.g. Title,Description" />
            {excel.headers.length > 0 && (
              <div>
                <div className="text-sm text-gray-600">Or select from detected headers</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {excel.headers.map((h)=> (
                    <label key={h} className={`px-2 py-1 border rounded cursor-pointer ${selectedCols.includes(h)? 'bg-blue-600 text-white' : 'bg-white dark:bg-black/40'}` }>
                      <input
                        type="checkbox"
                        className="mr-1"
                        checked={selectedCols.includes(h)}
                        onChange={(e)=> {
                          setSelectedCols((prev)=> e.target.checked ? [...prev, h] : prev.filter(x=>x!==h));
                        }}
                      />
                      {h}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <label className="block text-sm font-medium">Sheet name (optional)</label>
            <input type="text" className="w-full p-2 border rounded" value={sheet} onChange={e=>setSheet(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Additional context</label>
            <textarea className="w-full h-24 p-2 border rounded" value={context} onChange={e=>setContext(e.target.value)} />
            <label className="block text-sm font-medium">Batch size</label>
            <input type="number" className="w-40 p-2 border rounded" value={batch} onChange={e=>setBatch(parseInt(e.target.value||"15",10))} />
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading} type="submit">
                {loading ? "Estimating..." : "Estimate impact"}
              </button>
              <button type="button" className="px-4 py-2 bg-emerald-600 text-white rounded" onClick={downloadXlsx}>Download XLSX</button>
            </div>
            {error && <div className="p-2 border border-red-300 text-red-700 rounded">{error}</div>}
          </div>
        </form>

        {result && (
          <section>
            <h2 className="text-2xl font-semibold mb-2">Results</h2>
            <div className="overflow-auto border rounded">
              <table className="min-w-full text-sm">
                <thead>
                  <tr>
                    {result.columns.map(c => (<th className="text-left p-2 border-b" key={c}>{c}</th>))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r, idx)=> (
                    <tr key={idx} className="odd:bg-black/5 dark:odd:bg-white/5">
                      {result.columns.map(c => (<td key={c} className="p-2 align-top">{String(r[c] ?? "")}</td>))}
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
