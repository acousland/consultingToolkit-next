"use client";
import { useState } from "react";

type Out = { strategies: string[] };

export default function TacticsToStrategies() {
  const [tactics, setTactics] = useState<string[]>(["Launch social media campaign"]);
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateTactic(i:number,val:string){ setTactics(prev=>prev.map((t,idx)=>idx===i?val:t)); }
  function addTactic(){ setTactics(prev=>[...prev, ""]); }
  function removeTactic(i:number){ setTactics(prev=>prev.filter((_,idx)=>idx!==i)); }

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/strategy/tactics/generate", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ tactics })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e){ setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Tactics to Strategies Generator</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          {tactics.map((t,i)=>(
            <div key={i} className="flex gap-2">
              <input value={t} onChange={e=>updateTactic(i,e.target.value)} className="flex-1 p-2 rounded-md border border-black/10" />
              <button type="button" onClick={()=>removeTactic(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
            </div>
          ))}
          <button type="button" onClick={addTactic} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add tactic</button>
          <button disabled={loading||tactics.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Generating...":"Generate strategies"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <ul className="list-disc pl-6 space-y-1">
            {out.strategies.map((s,i)=>(<li key={i}>{s}</li>))}
          </ul>
        )}
      </div>
    </main>
  );
}
