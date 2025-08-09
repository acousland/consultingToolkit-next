"use client";
import { useState } from "react";
import * as XLSX from "xlsx";

interface Mapping {
  data_entity: string;
  application: string;
  relationship: string;
  rationale: string;
}

interface MapOut { mappings: Mapping[] }

export default function DataApplicationMap() {
  const [dataEntities, setDataEntities] = useState<string[]>(["Customer", "Order"]);
  const [applications, setApplications] = useState<string[]>(["CRM", "ERP"]);
  const [out, setOut] = useState<MapOut | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function update(list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, val: string) {
    setter(prev => prev.map((v, idx) => idx === i ? val : v));
  }
  function add(setter: React.Dispatch<React.SetStateAction<string[]>>) { setter(prev => [...prev, ""]); }
  function remove(list: string[], setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) { setter(prev => prev.filter((_, idx) => idx !== i)); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/data/application/map", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data_entities: dataEntities, applications })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as MapOut);
    } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); }
    finally { setLoading(false); }
  }

  function download() {
    if (!out) return;
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(out.mappings.map(m => ({
      Data_Entity: m.data_entity,
      Application: m.application,
      Relationship: m.relationship,
      Rationale: m.rationale
    })));
    XLSX.utils.book_append_sheet(wb, sheet, "Mappings");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "data_application_mapping.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Data-Application Mapping</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Data Entities</div>
            {dataEntities.map((d, i) => (
              <div key={i} className="flex gap-2">
                <input value={d} onChange={e => update(dataEntities, setDataEntities, i, e.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
                <button type="button" onClick={() => remove(dataEntities, setDataEntities, i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => add(setDataEntities)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add data entity</button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Applications</div>
            {applications.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input value={a} onChange={e => update(applications, setApplications, i, e.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
                <button type="button" onClick={() => remove(applications, setApplications, i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
              </div>
            ))}
            <button type="button" onClick={() => add(setApplications)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add application</button>
          </div>
          <button disabled={loading || dataEntities.length === 0 || applications.length === 0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="space-y-3">
            <div className="rounded-xl border border-black/10 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-black/5"><th className="text-left p-2">Data Entity</th><th className="text-left p-2">Application</th><th className="text-left p-2">Relationship</th><th className="text-left p-2">Rationale</th></tr>
                </thead>
                <tbody>
                  {out.mappings.map((m,i) => (
                    <tr key={i} className="odd:bg-black/5"><td className="p-2 align-top">{m.data_entity}</td><td className="p-2 align-top">{m.application}</td><td className="p-2 align-top">{m.relationship}</td><td className="p-2 text-sm">{m.rationale}</td></tr>
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
