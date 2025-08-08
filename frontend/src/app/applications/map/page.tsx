"use client";
import { useState } from "react";

type Cap = { id: string; name: string };
type Out = { capability_ids: string[] };

export default function IndividualAppMap() {
  const [desc, setDesc] = useState("Our CRM manages customer onboarding and support");
  const [caps, setCaps] = useState<Cap[]>([{ id: "CAP-001", name: "Customer Management" }, { id: "CAP-002", name: "Support" }]);
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateCap(i:number, patch:Partial<Cap>) { setCaps(prev=>prev.map((c,idx)=>idx===i?{...c,...patch}:c)); }
  function addCap() { setCaps(prev=>[...prev,{ id:"", name:"" }]); }
  function removeCap(i:number) { setCaps(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/applications/map", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ application_description: desc, capabilities: caps })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e) { setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Individual Application Mapping</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Application Description</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} className="w-full h-24 p-3 rounded-md border border-black/10" />
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
          <button disabled={loading||caps.length===0||!desc} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="rounded-xl border border-black/10 p-4"><strong>Capability IDs:</strong> {out.capability_ids.join(", ")}</div>
        )}
      </div>
    </main>
  );
}
