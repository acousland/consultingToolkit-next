"use client";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";

interface ExtractRes { pain_points: string[] }

export default function PainPoints() {
  const [rowsText, setRowsText] = useState("");
  const [extra, setExtra] = useState("");
  const [chunk, setChunk] = useState(20);
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [error, setError] = useState("");

  const rows = useMemo(() => rowsText.split("\n").map(s => s.trim()).filter(Boolean), [rowsText]);

  async function runText() {
    setLoading(true); setError(""); setPoints([]);
    try {
      const res = await api<ExtractRes>("/ai/pain-points/extract/text", {
        method: "POST",
        body: JSON.stringify({ rows, additional_prompts: extra, chunk_size: chunk }),
      });
      setPoints(res.pain_points);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed";
      setError(msg);
    } finally { setLoading(false); }
  }

  async function runFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setPoints([]);
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const colsInput = form.elements.namedItem("columns") as HTMLInputElement;
    const sheetInput = form.elements.namedItem("sheet") as HTMLInputElement;
    if (!fileInput.files?.[0]) { setError("Select a file"); setLoading(false); return; }
    const fd = new FormData();
    fd.append("file", fileInput.files[0]);
    fd.append("selected_columns", JSON.stringify(colsInput.value.split(",").map(s => s.trim()).filter(Boolean)));
    fd.append("additional_prompts", extra);
    fd.append("chunk_size", String(chunk));
    if (sheetInput.value) fd.append("sheet_name", sheetInput.value);
    try {
      const res = await fetch(`/api/ai/pain-points/extract/file`, { method: "POST", body: fd });
      // Use Next.js middleware/proxy or direct API_BASE; here assume /api routes proxy to backend
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ExtractRes;
      setPoints(json.pain_points);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="text-3xl font-bold">Pain Point Extraction</h1>
        <p className="text-gray-600">Paste rows of text, or upload a CSV/Excel and list the columns to concatenate.</p>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium">Rows (one per line)</label>
            <textarea className="w-full h-48 p-3 border rounded" value={rowsText} onChange={e=>setRowsText(e.target.value)} />
            <button className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50" disabled={loading || rows.length===0} onClick={runText}>
              {loading ? "Extracting..." : "Extract from text"}
            </button>
          </div>

          <form className="space-y-3" onSubmit={runFile}>
            <label className="block text-sm font-medium">Upload CSV/XLSX</label>
            <input type="file" name="file" accept=".csv,.xls,.xlsx,.xlsm" className="block" />
            <label className="block text-sm font-medium">Columns (comma-separated)</label>
            <input type="text" name="columns" placeholder="title,description" className="w-full p-2 border rounded" />
            <label className="block text-sm font-medium">Sheet name (optional)</label>
            <input type="text" name="sheet" className="w-full p-2 border rounded" />
            <button className="px-4 py-2 bg-gray-900 text-white rounded disabled:opacity-50" disabled={loading} type="submit">
              {loading ? "Uploading..." : "Extract from file"}
            </button>
          </form>
        </section>

        <section className="grid md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Additional context</label>
            <textarea className="w-full h-24 p-2 border rounded" value={extra} onChange={e=>setExtra(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium">Chunk size</label>
            <input type="number" className="w-40 p-2 border rounded" value={chunk} onChange={e=>setChunk(parseInt(e.target.value||"20",10))} />
          </div>
        </section>

        {error && <div className="p-3 border border-red-300 text-red-700 rounded">{error}</div>}

        {points.length > 0 && (
          <section>
            <h2 className="text-2xl font-semibold mb-2">Extracted Pain Points ({points.length})</h2>
            <ol className="list-decimal pl-6 space-y-1">
              {points.map((p,i)=>(<li key={i}>{p}</li>))}
            </ol>
          </section>
        )}
      </div>
    </main>
  );
}
