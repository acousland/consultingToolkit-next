"use client";
import { useState } from "react";

type Out = { custom_use_case: string };

export default function UseCaseCustomise() {
  const [template, setTemplate] = useState("Automate {context} with AI");
  const [context, setContext] = useState("invoice processing");
  const [out, setOut] = useState<Out | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e:React.FormEvent){
    e.preventDefault(); setErr(""); setOut(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/use-case/customise", {
        method:"POST", headers:{"content-type":"application/json"},
        body: JSON.stringify({ template, context })
      });
      const j = await r.json();
      if(!r.ok) throw new Error(j?.detail || "Request failed");
      setOut(j as Out);
    } catch(e){ setErr(e instanceof Error?e.message:"Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">AI Use Case Customiser</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Template</label>
            <input value={template} onChange={e=>setTemplate(e.target.value)} className="w-full p-2 rounded-md border border-black/10" />
          </div>
          <div>
            <label className="block text-sm font-medium">Context</label>
            <input value={context} onChange={e=>setContext(e.target.value)} className="w-full p-2 rounded-md border border-black/10" />
          </div>
          <button disabled={loading||!template||!context} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Customising...":"Customise"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {out && (
          <div className="p-4 border border-black/10 rounded-md bg-black/5">{out.custom_use_case}</div>
        )}
      </div>
    </main>
  );
}
