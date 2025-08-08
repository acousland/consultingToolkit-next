"use client";
import { useState } from "react";

type Out = { touchpoints: string[] };

export default function EngagementPlan() {
  const [audience, setAudience] = useState("Customers");
  const [goal, setGoal] = useState("Introduce new features");
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e:React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/engagement/plan", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ audience, goal })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e) { setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">Engagement Touchpoint Planning</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Audience</label>
            <input value={audience} onChange={e=>setAudience(e.target.value)} className="w-full p-2 rounded-md border border-black/10" />
          </div>
          <div>
            <label className="block text-sm font-medium">Goal</label>
            <input value={goal} onChange={e=>setGoal(e.target.value)} className="w-full p-2 rounded-md border border-black/10" />
          </div>
          <button disabled={loading||!audience||!goal} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Planning...":"Generate plan"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <ul className="list-disc pl-6 space-y-1">
            {out.touchpoints.map((t,i)=>(<li key={i}>{t}</li>))}
          </ul>
        )}
      </div>
    </main>
  );
}
