"use client";
import React, { useState, useMemo } from "react";

interface ProposalRow {
  id: string; original: string; group_id: string; proposed: string; action: string; rationale: string; merged_ids: string[];
}
interface ProposalResponse { proposal: ProposalRow[]; summary: Record<string, any>; }
interface ApplyResponse { clean_pain_points: { id: string; text: string }[]; count: number; }

export default function CleanupPage() {
  const [rawText, setRawText] = useState("");
  const [styleRules, setStyleRules] = useState({ present_tense: true, remove_metrics: true, remove_proper_nouns: false, max_length: true });
  const [thresholds, setThresholds] = useState({ merge: 0.80 });
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalRow[]>([]);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [finalList, setFinalList] = useState<{id:string;text:string}[]>([]);

  const rawPoints = useMemo(()=> rawText.split("\n").map(s=>s.trim()).filter(Boolean), [rawText]);

  async function generateProposal() {
    setLoading(true); setError(""); setProposal([]); setFinalList([]);
    try {
      const res = await fetch("/api/ai/pain-points/cleanup/propose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ raw_points: rawPoints, options: { style_rules: styleRules, thresholds, context } }) });
      if(!res.ok) throw new Error(await res.text());
      const json = await res.json() as ProposalResponse;
      setProposal(json.proposal); setSummary(json.summary);
    } catch(e:any){ setError(e.message || "Failed"); } finally { setLoading(false); }
  }

  function updateAction(id: string, action: string, proposed?: string) {
    setProposal(prev => prev.map(r => r.id === id ? { ...r, action, proposed: proposed !== undefined ? proposed : r.proposed } : r));
  }

  function bulkAccept() {
    // placeholder: could adjust many actions at once
  }

  async function applyChanges() {
    try {
      const res = await fetch("/api/ai/pain-points/cleanup/apply", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal }) });
      if(!res.ok) throw new Error(await res.text());
      const json = await res.json() as ApplyResponse;
      setFinalList(json.clean_pain_points);
    } catch(e:any){ setError(e.message || "Failed to apply"); }
  }

  async function downloadReport() {
    try {
      const res = await fetch("/api/ai/pain-points/cleanup/report.xlsx", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proposal, summary }) });
      if(!res.ok) throw new Error("Report failed");
      const blob = await res.blob(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "cleanup_report.xlsx"; a.click(); URL.revokeObjectURL(url);
    } catch(e:any){ setError(e.message); }
  }

  return (
    <main className="space-y-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">Pain Point Cleanup & Normalisation</h1>
        <p className="text-gray-400 max-w-2xl mx-auto">Refine raw pain point statements: dedupe, cluster, rewrite weak items, merge near duplicates and export a canonical list.</p>
      </header>
      <section className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-4">
          <div>
            <label className="text-sm font-medium">Raw Pain Points (one per line)</label>
            <textarea className="w-full h-48 mt-1 p-3 rounded-xl border border-white/10 bg-black/40" value={rawText} onChange={e=>setRawText(e.target.value)} placeholder="Login times out after 2 minutes\nDuplicate customer records appear in CRM\n..." />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Style Rules</h3>
              {Object.entries(styleRules).map(([k,v]) => (
                <label key={k} className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={v} onChange={()=> setStyleRules(sr=> ({...sr, [k]: !sr[k as keyof typeof sr]}))} />
                  <span>{k}</span>
                </label>
              ))}
              <div className="mt-2">
                <label className="block text-xs font-medium">Merge Threshold: {thresholds.merge.toFixed(2)}</label>
                <input type="range" min={0.5} max={0.95} step={0.01} value={thresholds.merge} onChange={e=> setThresholds({ merge: parseFloat(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-sm">Additional Context</h3>
              <textarea className="w-full h-32 p-2 rounded-xl border border-white/10 bg-black/40 text-xs" value={context} onChange={e=>setContext(e.target.value)} placeholder="Optional domain / organisation context" />
              <button disabled={loading || rawPoints.length===0} onClick={generateProposal} className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm disabled:opacity-50">{loading ? "Analysing..." : "Analyse & Propose Cleanup"}</button>
            </div>
          </div>
          {summary.total_raw !== undefined && (
            <div className="flex flex-wrap gap-3 text-xs mt-2">
              {Object.entries(summary).map(([k,v]) => (<span key={k} className="px-2 py-1 rounded-full bg-white/5 border border-white/10">{k}: {v as any}</span>))}
            </div>
          )}
        </div>
        <div className="space-y-4">
            <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-xs leading-relaxed">Enter raw statements and configure style rules & merge threshold. The tool clusters similar items and suggests rewrites or merges.</div>
            {proposal.length>0 && (
              <div className="space-y-2">
                <button onClick={bulkAccept} className="w-full px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20">Bulk Accept (default)</button>
                <button onClick={applyChanges} className="w-full px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white">Apply Accepted Changes</button>
                <button onClick={downloadReport} className="w-full px-3 py-2 text-sm rounded-lg bg-purple-600 text-white">Download Report (XLSX)</button>
              </div>
            )}
        </div>
      </section>
      {error && <div className="p-3 rounded-md border border-red-500/40 bg-red-500/10 text-sm">{error}</div>}
      {proposal.length>0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Proposed Cleanup ({proposal.length})</h2>
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-xs">
              <thead className="bg-white/5">
                <tr className="text-left">
                  <th className="p-2">ID</th><th className="p-2">Group</th><th className="p-2">Original</th><th className="p-2">Proposed</th><th className="p-2">Action</th><th className="p-2">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {proposal.map(r => (
                  <tr key={r.id} className="border-t border-white/5 align-top">
                    <td className="p-2 font-mono">{r.id}</td>
                    <td className="p-2">{r.group_id}</td>
                    <td className="p-2 w-[25%] whitespace-pre-wrap">{r.original}</td>
                    <td className="p-2 w-[25%]">
                      {r.action.startsWith("Merge") ? <span className="italic opacity-60">(merged)</span> : (
                        <textarea className="w-full bg-black/30 border border-white/10 rounded p-1" value={r.proposed} onChange={e=> updateAction(r.id, r.action, e.target.value)} />
                      )}
                    </td>
                    <td className="p-2">
                      <select className="bg-black/40 border border-white/10 rounded p-1" value={r.action} onChange={e=> updateAction(r.id, e.target.value)}>
                        <option value="Keep">Keep</option>
                        <option value="Rewrite">Rewrite</option>
                        <option value={`Merge->${r.id}`}>Merge (self)</option>
                        <option value="Drop">Drop</option>
                        {r.action.startsWith("Merge->") && <option value={r.action}>{r.action}</option>}
                      </select>
                    </td>
                    <td className="p-2 min-w-40">{r.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {finalList.length>0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Final Canonical List ({finalList.length})</h2>
          <ol className="list-decimal pl-6 space-y-1 text-sm">
            {finalList.map(r => <li key={r.id}>{r.text}</li>)}
          </ol>
        </section>
      )}
    </main>
  );
}
