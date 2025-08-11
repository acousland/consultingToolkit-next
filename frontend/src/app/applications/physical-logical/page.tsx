"use client";
import { useState } from "react";

type PhysicalApp = { id: string; name: string; description: string };
type LogicalApp = { id: string; name: string; description: string };
interface MappingRecord { physical_id:string; physical_name:string; logical_id:string; logical_name:string; similarity:number; rationale:string; uncertainty:boolean }
interface ResponseData { mappings: MappingRecord[]; summary: Record<string, any> }

export default function PhysicalLogicalMappingPage() {
  const [physical, setPhysical] = useState<PhysicalApp[]>([{ id:"P1", name:"CRM Platform", description:"Handles customer lifecycle and sales pipeline" }]);
  const [logical, setLogical] = useState<LogicalApp[]>([{ id:"L1", name:"Customer Relationship Management", description:"Logical grouping for managing customers, interactions, and pipeline" }]);
  const [context, setContext] = useState("");
  const [threshold, setThreshold] = useState(0.22);
  const [data, setData] = useState<ResponseData|null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updatePhysical(i:number, patch:Partial<PhysicalApp>) { setPhysical(p=>p.map((r,idx)=>idx===i?{...r,...patch}:r)); }
  function addPhysical(){ setPhysical(p=>[...p,{ id:"", name:"", description:"" }]); }
  function removePhysical(i:number){ setPhysical(p=>p.filter((_,idx)=>idx!==i)); }

  function updateLogical(i:number, patch:Partial<LogicalApp>) { setLogical(p=>p.map((r,idx)=>idx===i?{...r,...patch}:r)); }
  function addLogical(){ setLogical(p=>[...p,{ id:"", name:"", description:"" }]); }
  function removeLogical(i:number){ setLogical(p=>p.filter((_,idx)=>idx!==i)); }

  async function run(e:React.FormEvent){
    e.preventDefault(); setErr(""); setLoading(true); setData(null);
    try {
      const res = await fetch("/api/ai/applications/physical-logical/map", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ physical_apps: physical, logical_apps: logical, context, uncertainty_threshold: threshold }) });
      const j = await res.json();
      if(!res.ok) throw new Error(j?.detail || "Request failed");
      setData(j as ResponseData);
    } catch(e){ setErr(e instanceof Error? e.message : "Request failed"); } finally { setLoading(false); }
  }

  async function downloadExcel(){
    try {
      const res = await fetch("/api/ai/applications/physical-logical/map.xlsx", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ physical_apps: physical, logical_apps: logical, context, uncertainty_threshold: threshold }) });
      if(!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "physical_logical_mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <main>
      <div className="mx-auto max-w-6xl space-y-8">
        <h1 className="text-3xl font-bold">Physical → Logical Application Mapping</h1>
        <p className="text-sm text-black/70 max-w-3xl">Map each physical application to exactly one logical application (MECE). Similarity is heuristic (lexical) in this MVP; low similarity rows are flagged as uncertain for manual review.</p>
        <form onSubmit={run} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Physical Applications</h2><button type="button" onClick={addPhysical} className="text-xs px-2 py-1 rounded border border-black/10 hover:bg-black/5">Add</button></div>
              {physical.map((p,i)=> (
                <div key={i} className="space-y-1 border border-black/10 p-3 rounded-md">
                  <div className="flex gap-2">
                    <input value={p.id} onChange={e=>updatePhysical(i,{id:e.target.value})} placeholder="ID" className="w-28 p-2 rounded border border-black/10" />
                    <input value={p.name} onChange={e=>updatePhysical(i,{name:e.target.value})} placeholder="Name" className="flex-1 p-2 rounded border border-black/10" />
                    <button type="button" onClick={()=>removePhysical(i)} className="text-xs px-2 py-1 rounded border border-black/10 hover:bg-black/5">✕</button>
                  </div>
                  <textarea value={p.description} onChange={e=>updatePhysical(i,{description:e.target.value})} placeholder="Description" className="w-full p-2 rounded border border-black/10 text-sm" rows={2} />
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between"><h2 className="font-semibold">Logical Applications</h2><button type="button" onClick={addLogical} className="text-xs px-2 py-1 rounded border border-black/10 hover:bg-black/5">Add</button></div>
              {logical.map((p,i)=> (
                <div key={i} className="space-y-1 border border-black/10 p-3 rounded-md">
                  <div className="flex gap-2">
                    <input value={p.id} onChange={e=>updateLogical(i,{id:e.target.value})} placeholder="ID" className="w-28 p-2 rounded border border-black/10" />
                    <input value={p.name} onChange={e=>updateLogical(i,{name:e.target.value})} placeholder="Name" className="flex-1 p-2 rounded border border-black/10" />
                    <button type="button" onClick={()=>removeLogical(i)} className="text-xs px-2 py-1 rounded border border-black/10 hover:bg-black/5">✕</button>
                  </div>
                  <textarea value={p.description} onChange={e=>updateLogical(i,{description:e.target.value})} placeholder="Description" className="w-full p-2 rounded border border-black/10 text-sm" rows={2} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Context</label>
              <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full p-2 rounded border border-black/10 text-sm" rows={3} placeholder="Business context, scope guidance..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">Uncertainty Threshold <span className="text-xs text-black/50">({threshold.toFixed(2)})</span></label>
              <input type="range" min={0} max={0.8} step={0.01} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value))} className="w-full" />
              <p className="text-xs text-black/60">Rows with similarity below threshold are flagged for manual validation.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button disabled={loading || physical.length===0 || logical.length===0} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map Physical → Logical"}</button>
            {data && <button type="button" onClick={downloadExcel} className="px-4 py-2 rounded border border-black/10 hover:bg-black/5">Download Excel</button>}
            {data && <button type="button" onClick={()=>setData(null)} className="px-4 py-2 rounded border border-black/10 hover:bg-black/5">New Session</button>}
          </div>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {data && (
          <div className="space-y-4">
            <div className="text-sm flex flex-wrap gap-3">
              <span className="px-2 py-1 rounded bg-black/5">Physical: {data.summary.physical}</span>
              <span className="px-2 py-1 rounded bg-black/5">Logical: {data.summary.logical}</span>
              <span className="px-2 py-1 rounded bg-black/5">Mapped: {data.summary.mapped}</span>
              <span className="px-2 py-1 rounded bg-black/5">Uncertain: {data.summary.uncertain}</span>
              <span className="px-2 py-1 rounded bg-black/5">MECE Coverage: {data.summary.mece_physical_coverage?"Yes":"No"}</span>
            </div>
            <div className="rounded-xl border border-black/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/5 text-left">
                    <th className="p-2">Physical (ID)</th>
                    <th className="p-2">Logical (ID)</th>
                    <th className="p-2">Similarity</th>
                    <th className="p-2">Rationale</th>
                    <th className="p-2">Uncertain</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map(m => (
                    <tr key={m.physical_id} className="odd:bg-black/5 align-top">
                      <td className="p-2"><div className="font-medium">{m.physical_name}</div><div className="text-xs text-black/60">{m.physical_id}</div></td>
                      <td className="p-2"><div className="font-medium">{m.logical_name}</div><div className="text-xs text-black/60">{m.logical_id}</div></td>
                      <td className="p-2 tabular-nums">{m.similarity.toFixed(3)}</td>
                      <td className="p-2 max-w-sm whitespace-pre-wrap">{m.rationale}</td>
                      <td className="p-2">{m.uncertainty && <span className="text-xs px-2 py-1 rounded bg-amber-200 text-amber-900">Check</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
