"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

interface Result {
  use_case: string;
  customised: string;
  score: number;
  rationale: string;
}

interface Out { results: Result[] }

export default function UseCaseCustomiser() {
  const [context, setContext] = useState("");
  const [useCases, setUseCases] = useState("Predict churn\nAutomate billing");
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const list = useCases.split("\n").map(s => s.trim()).filter(Boolean);
      const r = await fetch("/api/ai/use-case/customise", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ use_cases: list, context })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setLoading(false); }
  }

  function download() {
    if (!out) return;
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(out.results.map(r => ({
      Use_Case: r.use_case,
      Customised: r.customised,
      Score: r.score,
      Rationale: r.rationale
    })));
    XLSX.utils.book_append_sheet(wb, sheet, "Customised Use Cases");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "customised_use_cases.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">AI Use Case Customiser</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Company Context</label>
            <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full h-32 p-3 rounded-md border border-black/10" />
          </div>
          <div>
            <label className="block text-sm font-medium">Use Cases (one per line)</label>
            <textarea value={useCases} onChange={e=>setUseCases(e.target.value)} className="w-full h-40 p-3 rounded-md border border-black/10" />
          </div>
          <button disabled={loading || !useCases.trim()} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Customising...":"Customise"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="space-y-3">
            <div className="rounded-xl border border-black/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/5"><th className="text-left p-2">Use Case</th><th className="text-left p-2">Customised</th><th className="text-left p-2">Score</th><th className="text-left p-2">Rationale</th></tr>
                </thead>
                <tbody>
                  {out.results.map((r,i)=> (
                    <tr key={i} className="odd:bg-black/5"><td className="p-2 align-top">{r.use_case}</td><td className="p-2 align-top">{r.customised}</td><td className="p-2 align-top">{r.score}</td><td className="p-2 text-sm">{r.rationale}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button onClick={download} className="px-4 py-2 rounded-md border border-black/10 hover:bg-black/5">Download Excel</button>
          </div>
        )}
      </div>
    </main>
  );
}
