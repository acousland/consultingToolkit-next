"use client";
import { useState } from "react";

type App = { id: string; name: string };
type Out = { model: string[] };

export default function LogicalAppModel() {
  const [apps, setApps] = useState<App[]>([{ id: "APP-001", name: "CRM" }, { id: "APP-002", name: "Billing" }]);
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateApp(i:number, patch:Partial<App>) { setApps(prev=>prev.map((a,idx)=>idx===i?{...a,...patch}:a)); }
  function addApp() { setApps(prev=>[...prev,{ id:"", name:"" }]); }
  function removeApp(i:number) { setApps(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/applications/logical-model", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ applications: apps })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e) { setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Logical Application Model</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {apps.map((a,i)=> (
            <div key={i} className="grid grid-cols-2 gap-2">
              <input value={a.id} onChange={e=>updateApp(i,{id:e.target.value})} placeholder="ID" className="p-2 rounded-md border border-black/10" />
              <div className="flex gap-2">
                <input value={a.name} onChange={e=>updateApp(i,{name:e.target.value})} placeholder="Name" className="flex-1 p-2 rounded-md border border-black/10" />
                <button type="button" onClick={()=>removeApp(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={addApp} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add application</button>
          <button disabled={loading||apps.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Generating...":"Generate model"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <ul className="list-disc pl-6 space-y-1">
            {out.model.map((m,i)=>(<li key={i}>{m}</li>))}
          </ul>
        )}
      </div>
    </main>
  );
}
