"use client";
import { useState } from "react";

interface ScoreBlock { summary?: string; score?: number }
interface SummaryBlock { composite?: number; recommendation?: string }
interface EthicsRes { deontological: ScoreBlock; utilitarian: ScoreBlock; social_contract: ScoreBlock; virtue: ScoreBlock; summary: SummaryBlock }

export default function UseCaseEthics() {
  const [text, setText] = useState("");
  const [res, setRes] = useState<EthicsRes | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setRes(null); setLoading(true);
    try {
      const r = await fetch("/api/ai/ethics/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ use_case: text }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || "Request failed");
      setRes(j as EthicsRes);
  } catch (e) { setErr(e instanceof Error ? e.message : "Request failed"); } finally { setLoading(false); }
  }

  const Card = ({title, obj}:{title:string, obj:ScoreBlock}) => (
    <div className="rounded-xl border border-black/10">
      <div className="p-3 font-semibold">{title}</div>
      <div className="p-3 text-sm text-gray-700">
        <div><span className="font-medium">Score:</span> {obj?.score ?? "-"}</div>
        <div className="mt-1">{obj?.summary}</div>
      </div>
    </div>
  );

  return (
    <main>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-3xl font-bold">Use Case Ethics Review</h1>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Use Case</label>
            <textarea value={text} onChange={e=>setText(e.target.value)} className="w-full h-36 p-3 rounded-md border border-black/10" />
          </div>
          <button disabled={loading || !text.trim()} className="px-4 py-2 rounded-md bg-indigo-600 text-white disabled:opacity-50">{loading?"Reviewing...":"Review"}</button>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {res && (
          <div className="grid sm:grid-cols-2 gap-3">
            <Card title="Deontological" obj={res.deontological} />
            <Card title="Utilitarian" obj={res.utilitarian} />
            <Card title="Social Contract" obj={res.social_contract} />
            <Card title="Virtue" obj={res.virtue} />
            <div className="sm:col-span-2 rounded-xl border border-black/10">
              <div className="p-3 font-semibold">Summary</div>
              <div className="p-3 text-sm text-gray-700">
                <div><span className="font-medium">Composite:</span> {res.summary?.composite}</div>
                <div><span className="font-medium">Recommendation:</span> {res.summary?.recommendation}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
