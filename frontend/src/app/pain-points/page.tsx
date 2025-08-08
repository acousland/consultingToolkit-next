"use client";
import { useMemo, useState } from "react";
import { ExcelPicker, type ExcelSelection } from "@/components/ExcelPicker";

interface ExtractRes { pain_points: string[] }

export default function PainPoints() {
  const [tab, setTab] = useState<"text" | "file">("text");
  const [rowsText, setRowsText] = useState("");
  const [extra, setExtra] = useState("");
  const [chunk, setChunk] = useState(20);
  const [loading, setLoading] = useState(false);
  const [points, setPoints] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [excel, setExcel] = useState<ExcelSelection>({ file: null, sheet: null, headers: [], preview: [] });
  const [selectedCols, setSelectedCols] = useState<string[]>([]);

  const rows = useMemo(() => rowsText.split("\n").map(s => s.trim()).filter(Boolean), [rowsText]);

  async function runText() {
    setLoading(true); setError(""); setPoints([]);
    try {
      const res = await fetch(`/api/ai/pain-points/extract/text`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows, additional_prompts: extra, chunk_size: chunk }),
      });
      if (!res.ok) {
        const body = await res.text().catch(()=>"");
        throw new Error(body || `HTTP ${res.status}`);
      }
      const json = (await res.json()) as ExtractRes;
      setPoints(json.pain_points);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Load failed";
      setError(msg);
    } finally { setLoading(false); }
  }

  async function runFile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setPoints([]);
    if (!excel.file) { setError("Select a file"); setLoading(false); return; }
    if (selectedCols.length === 0) { setError("Select at least one column"); setLoading(false); return; }
    const fd = new FormData();
    fd.append("file", excel.file);
    fd.append("selected_columns", JSON.stringify(selectedCols));
    fd.append("additional_prompts", extra);
    fd.append("chunk_size", String(chunk));
    if (excel.sheet) fd.append("sheet_name", excel.sheet);
    if (typeof excel.headerRowIndex === 'number') fd.append("header_row_index", String(excel.headerRowIndex));
    try {
      const res = await fetch(`/api/ai/pain-points/extract/file`, { method: "POST", body: fd });
      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        let msg = `HTTP ${res.status}`;
        const body = await res.text().catch(() => "");
        if (ct.includes("application/json")) {
          try { const j = JSON.parse(body); msg = j.detail || j.message || msg; } catch {}
        } else if (body) { msg = body; }
        throw new Error(msg);
      }
      const json = (await res.json()) as ExtractRes;
      setPoints(json.pain_points);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Pain Point Cleanup</h1>
          <p className="text-gray-600 dark:text-gray-300">Paste rows of text or upload a spreadsheet. We’ll extract concise, deduplicated pain points.</p>
        </div>

        <div className="bg-white/70 dark:bg-white/5 backdrop-blur rounded-xl border border-black/10 dark:border-white/10 shadow-sm">
          <div className="flex">
            <button onClick={()=>setTab("text")} className={`flex-1 px-4 py-3 text-sm font-medium rounded-tl-xl ${tab==='text' ? 'bg-black/5 dark:bg-white/10' : ''}`}>From Text</button>
            <button onClick={()=>setTab("file")} className={`flex-1 px-4 py-3 text-sm font-medium rounded-tr-xl ${tab==='file' ? 'bg-black/5 dark:bg-white/10' : ''}`}>From File</button>
          </div>
          <div className="p-4 sm:p-6">
            {tab === 'text' ? (
              <div className="grid md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-3">
                  <label className="block text-sm font-medium">Rows (one per line)</label>
                  <textarea className="w-full h-48 p-3 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-black/40" value={rowsText} onChange={e=>setRowsText(e.target.value)} placeholder={"Example:\nCheckout crashes on voucher apply\nStaff re-enter data into CRM\n..."} />
                  <button className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50" disabled={loading || rows.length===0} onClick={runText}>
                    {loading ? "Extracting..." : "Extract from text"}
                  </button>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium">Additional context</label>
                  <textarea className="w-full h-24 p-2 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-black/40" value={extra} onChange={e=>setExtra(e.target.value)} placeholder="Optional: business, domain, audience..." />
                  <label className="block text-sm font-medium">Chunk size</label>
                  <input type="number" className="w-40 p-2 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-black/40" value={chunk} onChange={e=>setChunk(parseInt(e.target.value||"20",10))} />
                </div>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={runFile}>
                <div className="grid md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    <label className="block text-sm font-medium">Upload CSV/XLSX</label>
                    <ExcelPicker onChange={setExcel} />
                    {excel.headers.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium">Select columns to concatenate</label>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {excel.headers.map((h)=> (
                            <label key={h} className={`px-2 py-1 rounded-md border border-black/10 dark:border-white/10 cursor-pointer ${selectedCols.includes(h)? 'bg-indigo-600 text-white' : 'bg-white dark:bg-black/40'}` }>
                              <input
                                type="checkbox"
                                className="mr-1 hidden"
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
                  </div>
                  <div className="space-y-3">
                    <label className="block text-sm font-medium">Additional context</label>
                    <textarea className="w-full h-24 p-2 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-black/40" value={extra} onChange={e=>setExtra(e.target.value)} />
                    <label className="block text-sm font-medium">Chunk size</label>
                    <input type="number" className="w-40 p-2 rounded-md border border-black/10 dark:border-white/10 bg-white dark:bg-black/40" value={chunk} onChange={e=>setChunk(parseInt(e.target.value||"20",10))} />
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50" disabled={loading} type="submit">
                      {loading ? "Uploading..." : "Extract from file"}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {error && <div className="p-3 rounded-md border border-red-300 text-red-700 bg-red-50 dark:bg-red-950/30">{error}</div>}

        {points.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-2xl font-semibold">Extracted Pain Points ({points.length})</h2>
            <div className="rounded-xl border border-black/10 dark:border-white/10 overflow-hidden">
              <ol className="list-decimal pl-6 divide-y divide-black/10 dark:divide-white/10">
                {points.map((p,i)=>(<li key={i} className="p-3">{p}</li>))}
              </ol>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
