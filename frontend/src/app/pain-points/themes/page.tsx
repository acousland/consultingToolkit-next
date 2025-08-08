"use client";
import { useState } from "react";

interface ThemeMapRes {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export default function ThemePerspectiveMapping() {
  const [idCol, setIdCol] = useState("");
  const [textCols, setTextCols] = useState("");
  const [context, setContext] = useState("");
  const [batch, setBatch] = useState(10);
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ThemeMapRes | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setResult(null);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    if (!fileInput.files?.[0]) { setError("Select a file"); setLoading(false); return; }
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    fd.append("id_column", idCol);
    fd.append("text_columns", JSON.stringify(textCols.split(",").map(s=>s.trim()).filter(Boolean)));
    fd.append("additional_context", context);
    fd.append("batch_size", String(batch));
    if (sheet) fd.append("sheet_name", sheet);
    const res = await fetch("/api/ai/pain-points/themes/map", { method: "POST", body: fd });
    if (!res.ok) { setError(`HTTP ${res.status}`); setLoading(false); return; }
    const json = (await res.json()) as ThemeMapRes;
    setResult(json);
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Theme & Perspective Mapping</h1>
        <p className="text-gray-600">Upload pain points (CSV/XLSX), pick the ID and text columns, and get theme/perspective mappings.</p>

        <form className="grid md:grid-cols-2 gap-6" onSubmit={onSubmit}>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Upload CSV/XLSX</label>
            <input type="file" name="file" accept=".csv,.xls,.xlsx,.xlsm" className="block" />
            <label className="block text-sm font-medium">Pain Point ID column</label>
            <input type="text" className="w-full p-2 border rounded" value={idCol} onChange={e=>setIdCol(e.target.value)} placeholder="e.g. Pain_Point_ID" />
            <label className="block text-sm font-medium">Text columns (comma-separated)</label>
            <input type="text" className="w-full p-2 border rounded" value={textCols} onChange={e=>setTextCols(e.target.value)} placeholder="e.g. Title,Description" />
            <label className="block text-sm font-medium">Sheet name (optional)</label>
            <input type="text" className="w-full p-2 border rounded" value={sheet} onChange={e=>setSheet(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Additional context</label>
            <textarea className="w-full h-24 p-2 border rounded" value={context} onChange={e=>setContext(e.target.value)} />
            <label className="block text-sm font-medium">Batch size</label>
            <input type="number" className="w-40 p-2 border rounded" value={batch} onChange={e=>setBatch(parseInt(e.target.value||"10",10))} />
            <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading} type="submit">
              {loading ? "Mapping..." : "Map themes & perspectives"}
            </button>
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
