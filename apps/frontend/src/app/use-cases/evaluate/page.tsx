"use client";
import { useState } from "react";

interface EvalRes {
  scores: Record<string, number>;
  rationale: Record<string, string>;
}

export default function UseCaseEvaluate() {
  const [text, setText] = useState("");
  const [ctx, setCtx] = useState("");
  const [res, setRes] = useState<EvalRes | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setRes(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/use-case/evaluate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ use_case: text, company_context: ctx }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setRes(j as EvalRes);
  } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); } finally { setLoading(false); }
  }

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">Use Case Evaluation</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Use Case</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} className="w-full h-36 p-3 rounded-md border border-black/10" />
          </div>
          <div>
            <label className="block text-sm font-medium">Company Context (optional)</label>
            <textarea value={ctx} onChange={e=>setCtx(e.target.value)} className="w-full h-24 p-3 rounded-md border border-black/10" />
          </div>
          <button disabled={loading || !text.trim()} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Evaluating...":"Evaluate"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {res && (
          <div className="rounded-xl border border-black/10 overflow-hidden">
            <div className="p-4 font-medium">Scores</div>
            <ul className="divide-y divide-black/10">
              {Object.entries(res.scores).map(([k,v]) => (
                <li key={k} className="p-3 flex justify-between"><span>{k}</span><span className="font-semibold">{v}/100</span></li>
              ))}
            </ul>
            <div className="p-4 font-medium border-t border-black/10">Rationale</div>
            <ul className="divide-y divide-black/10">
              {Object.entries(res.rationale).map(([k,v]) => (
                <li key={k} className="p-3"><div className="font-semibold">{k}</div><div className="text-sm text-gray-700">{v}</div></li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
