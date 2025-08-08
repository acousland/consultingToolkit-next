"use client";
import { useState } from "react";

type App = { id: string; name: string; description: string };
type Cap = { id: string; name: string };
type Out = { application_id: string; capability_ids: string[] };

export default function ApplicationCapabilityMap() {
  const [apps, setApps] = useState<App[]>([{ id: "APP-001", name: "CRM", description: "manages customers" }]);
  const [caps, setCaps] = useState<Cap[]>([{ id: "CAP-001", name: "Customer Management" }]);
  const [out, setOut] = useState<Out[] | null>(null);
  const [err, setErr] = useState("" );
  const [loading, setLoading] = useState(false);

  function updateApp(i:number, patch:Partial<App>) { setApps(prev=>prev.map((a,idx)=>idx===i?{...a,...patch}:a)); }
  function addApp() { setApps(prev=>[...prev,{ id:"", name:"", description:"" }]); }
  function removeApp(i:number) { setApps(prev=>prev.filter((_,idx)=>idx!==i)); }

  function updateCap(i:number, patch:Partial<Cap>) { setCaps(prev=>prev.map((c,idx)=>idx===i?{...c,...patch}:c)); }
  function addCap() { setCaps(prev=>[...prev,{ id:"", name:"" }]); }
  function removeCap(i:number) { setCaps(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/applications/capabilities/map", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ applications: apps, capabilities: caps })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out[]);
    } catch(e) { setErr(e instanceof Error?e.message:"Request failed"); }
    finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-5xl space-y-4">
        <h1 className="text-3xl font-bold">Application → Capability Mapping</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Applications</div>
            {apps.map((a,i)=> (
              <div key={i} className="grid md:grid-cols-3 gap-2 items-start">
                <input value={a.id} onChange={e=>updateApp(i,{id:e.target.value})} placeholder="ID" className="p-2 rounded-md border border-black/10" />
                <input value={a.name} onChange={e=>updateApp(i,{name:e.target.value})} placeholder="Name" className="p-2 rounded-md border border-black/10" />
                <div className="flex gap-2">
                  <input value={a.description} onChange={e=>updateApp(i,{description:e.target.value})} placeholder="Description" className="flex-1 p-2 rounded-md border border-black/10" />
                  <button type="button" onClick={()=>removeApp(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addApp} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add application</button>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Capabilities</div>
            {caps.map((c,i)=> (
              <div key={i} className="grid grid-cols-2 gap-2 items-start">
                <input value={c.id} onChange={e=>updateCap(i,{id:e.target.value})} placeholder="ID" className="p-2 rounded-md border border-black/10" />
                <div className="flex gap-2">
                  <input value={c.name} onChange={e=>updateCap(i,{name:e.target.value})} placeholder="Name" className="flex-1 p-2 rounded-md border border-black/10" />
                  <button type="button" onClick={()=>removeCap(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addCap} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add capability</button>
          </div>
          <button disabled={loading||apps.length===0||caps.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-black/5"><th className="text-left p-2">Application</th><th className="text-left p-2">Capability IDs</th></tr></thead>
              <tbody>
                {out.map(o => (
                  <tr key={o.application_id} className="odd:bg-black/5"><td className="p-2 align-top">{o.application_id}</td><td className="p-2">{o.capability_ids.join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
