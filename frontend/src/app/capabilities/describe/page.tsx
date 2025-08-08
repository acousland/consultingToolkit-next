"use client";
import { useState } from "react";

type Item = { id: string; name: string; summary?: string };

type Out = { id: string; name: string; description: string };

export default function CapabilityDescribe() {
  const [items, setItems] = useState<Item[]>([{ id: "CAP-001", name: "Customer Onboarding", summary: "efficiently bring new customers into our services" }]);
  const [ctx, setCtx] = useState("");
  const [out, setOut] = useState<Out[] | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  function updateItem(i: number, patch: Partial<Item>) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }

  function addItem() { setItems(prev => [...prev, { id: "", name: "" }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/capabilities/describe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ items, company_context: ctx }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out[]);
  } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-4xl space-y-4">
        <h1 className="text-3xl font-bold">Capability Description Generator</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Company Context (optional)</label>
            <textarea value={ctx} onChange={(e)=>setCtx(e.target.value)} className="w-full h-24 p-3 rounded-md border border-black/10" />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Capabilities</div>
            {items.map((it, i) => (
              <div key={i} className="grid sm:grid-cols-3 gap-2 items-start">
                <input value={it.id} onChange={e=>updateItem(i,{id:e.target.value})} placeholder="ID (e.g., CAP-001)" className="p-2 rounded-md border border-black/10" />
                <input value={it.name} onChange={e=>updateItem(i,{name:e.target.value})} placeholder="Name" className="p-2 rounded-md border border-black/10" />
                <div className="flex gap-2">
                  <input value={it.summary || ""} onChange={e=>updateItem(i,{summary:e.target.value})} placeholder="Optional summary" className="flex-1 p-2 rounded-md border border-black/10" />
                  <button type="button" onClick={()=>removeItem(i)} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Remove</button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addItem} className="px-3 py-2 rounded-md border border-black/10 hover:bg-black/5">Add capability</button>
          </div>
          <button disabled={loading || items.length===0} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Generating...":"Generate descriptions"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <table className="w-full">
              <thead><tr className="bg-black/5"><th className="text-left p-2">ID</th><th className="text-left p-2">Name</th><th className="text-left p-2">Description</th></tr></thead>
              <tbody>
                {out.map((o)=> (
                  <tr key={o.id} className="odd:bg-black/5"><td className="p-2 align-top">{o.id}</td><td className="p-2 align-top">{o.name}</td><td className="p-2">{o.description}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
