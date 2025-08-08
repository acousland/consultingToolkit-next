"use client";
import { useState } from "react";

type Out = { model: string[] };

export default function ConceptualDataModel() {
  const [entities, setEntities] = useState<string[]>(["Customer", "Order", "Product"]);
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateEntity(i:number,val:string){ setEntities(prev=>prev.map((e,idx)=>idx===i?val:e)); }
  function addEntity(){ setEntities(prev=>[...prev, ""]); }
  function removeEntity(i:number){ setEntities(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/data/conceptual-model", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ entities })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e){ setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Conceptual Data Model Generator</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {entities.map((e,i)=>(
            <div key={i} className="flex gap-2">
              <input value={e} onChange={ev=>updateEntity(i,ev.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
              <button type="button" onClick={()=>removeEntity(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
            </div>
          ))}
          <button type="button" onClick={addEntity} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add entity</button>
          <button disabled={loading||entities.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Generating...":"Generate model"}</button>
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
