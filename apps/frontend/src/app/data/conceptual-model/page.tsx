"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

interface Entity {
  subject_area: string;
  entity: string;
  description: string;
}

interface ModelOut {
  subject_areas: string[];
  entities: Entity[];
}

export default function ConceptualDataModel() {
  const [context, setContext] = useState("");
  const [out, setOut] = useState<ModelOut | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/data/conceptual-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as ModelOut);
    } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setLoading(false); }
  }

  function download() {
    if (!out) return;
    const wb = XLSX.utils.book_new();
    const saSheet = XLSX.utils.aoa_to_sheet([["Subject Area"], ...out.subject_areas.map(a => [a])]);
    const entSheet = XLSX.utils.json_to_sheet(out.entities.map(e => ({
      Subject_Area: e.subject_area,
      Entity: e.entity,
      Description: e.description
    })));
    XLSX.utils.book_append_sheet(wb, saSheet, "Subject Areas");
    XLSX.utils.book_append_sheet(wb, entSheet, "Entities");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "conceptual_data_model.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Conceptual Data Model Generator</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Company Context</label>
            <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full h-40 p-3 rounded-md border border-black/10" />
          </div>
          <button disabled={loading || !context.trim()} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Generating...":"Generate"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Subject Areas</h2>
              <ul className="list-disc pl-6">
                {out.subject_areas.map((sa,i)=>(<li key={i}>{sa}</li>))}
              </ul>
            </div>
            <div>
              <h2 className="text-xl font-semibold">Data Entities</h2>
              <ul className="list-disc pl-6 space-y-1">
                {out.entities.map((e,i)=>(<li key={i}><span className="font-medium">{e.subject_area}:</span> {e.entity} – {e.description}</li>))}
              </ul>
            </div>
            <button onClick={download} className="px-4 py-2 rounded-md border border-black/10 hover:bg-black/5">Download Excel</button>
          </div>
        )}
      </div>
    </main>
  );
}
