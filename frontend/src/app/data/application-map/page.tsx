"use client";
import { useState } from "react";

type Out = { mappings: Record<string,string> };

export default function DataApplicationMap() {
  const [datasets, setDatasets] = useState<string[]>(["Customer Data", "Order Data"]);
  const [apps, setApps] = useState<string[]>(["CRM", "ERP"]);
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateList(list:string[], setter:(v:string[])=>void, i:number, val:string){ setter(list.map((v,idx)=>idx===i?val:v)); }
  function addDataset(){ setDatasets(prev=>[...prev,""]); }
  function removeDataset(i:number){ setDatasets(prev=>prev.filter((_,idx)=>idx!==i)); }
  function addApp(){ setApps(prev=>[...prev,""]); }
  function removeApp(i:number){ setApps(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/data/application/map", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ datasets, applications: apps })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e){ setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Data-Application Mapping</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Datasets</div>
            {datasets.map((d,i)=>(
              <div key={i} className="flex gap-2">
                <input value={d} onChange={e=>updateList(datasets,setDatasets,i,e.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
                <button type="button" onClick={()=>removeDataset(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addDataset} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add dataset</button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Applications</div>
            {apps.map((a,i)=>(
              <div key={i} className="flex gap-2">
                <input value={a} onChange={e=>updateList(apps,setApps,i,e.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
                <button type="button" onClick={()=>removeApp(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
              </div>
            ))}
            <button type="button" onClick={addApp} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add application</button>
          </div>
          <button disabled={loading||datasets.length===0||apps.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-black/5"><th className="text-left p-2">Dataset</th><th className="text-left p-2">Application</th></tr></thead>
              <tbody>
                {Object.entries(out.mappings).map(([ds,app])=> (
                  <tr key={ds} className="odd:bg-black/5"><td className="p-2 align-top">{ds}</td><td className="p-2">{app}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
