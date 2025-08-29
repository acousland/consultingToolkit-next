"use client";
import React, { useState, useMemo } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";

interface ProposalRow {
  id: string; original: string; group_id: string; proposed: string; action: string; rationale: string; merged_ids: string[];
}
interface ProposalResponse { proposal: ProposalRow[]; summary: Record<string, any>; }
interface ApplyResponse { clean_pain_points: { id: string; text: string }[]; count: number; }

export default function CleanupPage() {
  // Excel file upload state
  const [excelData, setExcelData] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  
  // Raw text input state
  const [rawText, setRawText] = useState("");
  
  // Input method selection
  const [inputMethod, setInputMethod] = useState<"excel" | "text">("text");
  
  const [styleRules, setStyleRules] = useState({ present_tense: true, remove_metrics: true, remove_proper_nouns: false, max_length: true });
  const [thresholds, setThresholds] = useState({ merge: 0.80 });
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [proposal, setProposal] = useState<ProposalRow[]>([]);
  const [summary, setSummary] = useState<Record<string, any>>({});
  const [error, setError] = useState("");
  const [finalList, setFinalList] = useState<{id:string;text:string}[]>([]);

  const rawPoints = useMemo(() => {
    if (inputMethod === "text") {
      return rawText.split("\n").map(s => s.trim()).filter(Boolean);
    }
    return [];
  }, [rawText, inputMethod]);

  const hasExcelData = excelData.file && excelData.textColumns.length > 0;
  const canProcess = (inputMethod === "text" && rawPoints.length > 0) || (inputMethod === "excel" && hasExcelData);

  async function generateProposal() {
    if (!canProcess) return;
    
    setLoading(true); 
    setError(""); 
    setProposal([]); 
    setFinalList([]);
    
    try {
      let points: string[] = [];
      
      if (inputMethod === "excel" && hasExcelData) {
        // Process Excel file to extract pain points
        const formData = new FormData();
        formData.append("file", excelData.file!);
        formData.append("sheet", excelData.sheet || "");
        formData.append("text_columns", JSON.stringify(excelData.textColumns));
        
        const extractRes = await fetch("/api/ai/pain-points/extract/file", {
          method: "POST",
          body: formData
        });
        
        if (!extractRes.ok) throw new Error("Failed to process Excel file");
        const extractData = await extractRes.json();
        points = extractData.pain_points || [];
      } else {
        points = rawPoints;
      }
      
      if (points.length === 0) {
        throw new Error("No pain points to process");
      }
      
      // Now process the cleanup
      const res = await fetch("/api/ai/pain-points/cleanup/propose", { 
        method: "POST", 
        headers: { "content-type": "application/json" }, 
        body: JSON.stringify({ 
          raw_points: points, 
          options: { 
            style_rules: styleRules, 
            thresholds, 
            context 
          } 
        }) 
      });
      
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json() as ProposalResponse;
      setProposal(json.proposal); 
      setSummary(json.summary);
    } catch(e: any) { 
      setError(e.message || "Failed"); 
    } finally { 
      setLoading(false); 
    }
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
    <main className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-slate-100">
      {/* Decorative gradients */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(circle_at_center,black,transparent_70%)]">
        <div className="absolute -top-32 -left-32 h-96 w-96 bg-fuchsia-600/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -right-40 h-[32rem] w-[32rem] bg-emerald-500/10 rounded-full blur-3xl" />
      </div>
      <div className="mx-auto relative z-10 max-w-7xl px-6 py-10 space-y-10">
        {/* Header */}
        <header className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 backdrop-blur-sm text-xs uppercase tracking-wider text-fuchsia-300/80">
            <span className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
            AI Normalisation Workflow
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-300 via-emerald-300 to-cyan-300 drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]">
            🧹 Pain Point Cleanup & Normalisation
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
            Transform raw, messy statements into a precise canonical catalogue. We cluster semantic duplicates, rewrite weak phrasing, merge near-matches and produce an export-ready set.
          </p>
        </header>

        {/* Input Method Selection */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">1.</span> Input Source
          </h2>
          <div className="group rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.4),0_10px_40px_-2px_rgba(0,0,0,0.35)] p-8 space-y-8 transition-colors">
            <div className="flex flex-wrap gap-4">
              {[
                { key: 'text', label: '📝 Raw Text' },
                { key: 'excel', label: '📊 Excel Upload' }
              ].map(btn => (
                <button
                  key={btn.key}
                  onClick={() => setInputMethod(btn.key as any)}
                  className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all outline-none ring-offset-2 ring-offset-slate-900 focus-visible:ring-2 ring-fuchsia-400/50 ${
                    inputMethod === btn.key
                      ? 'bg-gradient-to-br from-fuchsia-500/90 to-emerald-500/90 text-white shadow-lg shadow-fuchsia-800/30 hover:from-fuchsia-500 hover:to-emerald-500'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="relative z-10">{btn.label}</span>
                  {inputMethod === btn.key && <span className="absolute inset-0 rounded-xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.3),transparent)]" />}
                </button>
              ))}
            </div>

            {inputMethod === 'text' && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-200">Raw Pain Points (one per line)</label>
                <div className="relative">
                  <textarea
                    className="w-full h-56 resize-none rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner backdrop-blur"
                    value={rawText}
                    onChange={e => setRawText(e.target.value)}
                    placeholder={"Login times out after 2 minutes\nDuplicate customer records appear in CRM\nSystem crashes during peak hours\nReports take too long to generate"}
                  />
                  <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
                </div>
                <p className="text-xs text-slate-400">Current count: {rawPoints.length} pain points</p>
              </div>
            )}

            {inputMethod === 'excel' && (
              <div className="space-y-4">
                <ExcelDataInput
                  value={excelData}
                  onChange={setExcelData}
                  mode="multi-text"
                  labels={{ text: 'Pain Point Columns' }}
                />
                {hasExcelData && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm space-y-1">
                    <h3 className="font-medium text-emerald-300">✅ Excel File Ready</h3>
                    <p className="text-emerald-200/80"><strong>File:</strong> {excelData.file!.name}</p>
                    <p className="text-emerald-200/80"><strong>Sheet:</strong> {excelData.sheet || 'Default'}</p>
                    <p className="text-emerald-200/80"><strong>Columns:</strong> {excelData.textColumns.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Configuration */}
        {canProcess && (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">2.</span> Configure Cleanup
            </h2>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_-6px_rgba(0,0,0,0.5),0_16px_56px_-4px_rgba(0,0,0,0.45)] space-y-8">
              <div className="grid md:grid-cols-2 gap-10">
                <div className="space-y-5">
                  <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Style Rules</h3>
                  <div className="grid gap-3">
                    {Object.entries(styleRules).map(([key, value]) => (
                      <label key={key} className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm hover:bg-white/10 transition-colors">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => setStyleRules(sr => ({ ...sr, [key]: !sr[key as keyof typeof sr] }))}
                          className="h-4 w-4 rounded border-white/20 bg-slate-900 text-fuchsia-400 focus:ring-fuchsia-400/40"
                        />
                        <span className="text-slate-200 group-hover:text-white">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <label className="text-xs font-medium tracking-wide text-slate-400">Merge Threshold: <span className="text-fuchsia-300">{thresholds.merge.toFixed(2)}</span></label>
                    <input
                      type="range"
                      min={0.5}
                      max={0.95}
                      step={0.01}
                      value={thresholds.merge}
                      onChange={e => setThresholds({ merge: parseFloat(e.target.value) })}
                      className="w-full accent-fuchsia-400"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 uppercase tracking-wide">
                      <span>Conservative</span>
                      <span>Aggressive</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <h3 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Context (Optional)</h3>
                  <div className="relative">
                    <textarea
                      className="w-full h-44 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent shadow-inner"
                      value={context}
                      onChange={e => setContext(e.target.value)}
                      placeholder="Domain notes, scope boundaries, business terminology..."
                    />
                    <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Added context increases rewrite precision & cluster fidelity. Keep it concise (1–4 sentences).</p>
                </div>
              </div>

              <div>
                <button
                  disabled={loading || !canProcess}
                  onClick={generateProposal}
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-emerald-500 px-8 py-4 text-sm font-semibold tracking-wide text-white shadow-lg shadow-fuchsia-900/30 transition hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-0 -z-10 opacity-40 mix-blend-screen bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.6),transparent_60%)]" />
                  {loading ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Analysing & Generating Proposal...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span className="text-lg">🔍</span> Analyse & Propose Cleanup
                    </span>
                  )}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Summary */}
        {summary.total_raw !== undefined && (
          <section className="space-y-4">
            <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-6">
              <h3 className="font-semibold text-cyan-200 mb-3 flex items-center gap-2">📊 Analysis Summary</h3>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(summary).map(([key, value]) => (
                  <span key={key} className="px-3 py-1 rounded-full bg-cyan-400/15 border border-cyan-300/20 text-cyan-100/90">
                    {key.replace(/_/g, ' ')}: <strong className="text-cyan-50 font-semibold">{value as any}</strong>
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Error Display */}
        {error && (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-600/10 p-5 text-sm text-rose-200">❌ {error}</div>
        )}

        {/* Proposal Table */}
        {proposal.length > 0 && (
          <section className="space-y-8">
            <h2 className="text-2xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">3.</span> Review & Refine ({proposal.length})
            </h2>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={bulkAccept}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition"
              >Bulk Accept (default)</button>
              <button
                onClick={applyChanges}
                className="rounded-xl bg-emerald-600/90 hover:bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow shadow-emerald-900/40 transition"
              >Apply Accepted Changes</button>
              <button
                onClick={downloadReport}
                className="rounded-xl bg-violet-600/90 hover:bg-violet-500 px-5 py-2 text-xs font-semibold text-white shadow shadow-violet-900/40 transition"
              >📄 Download Report</button>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_4px_24px_-4px_rgba(0,0,0,0.5)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5">
                    <tr className="text-left text-slate-300">
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide">ID</th>
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide">Group</th>
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[24%]">Original</th>
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[24%]">Proposed</th>
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide">Action</th>
                      <th className="p-3 font-semibold text-xs uppercase tracking-wide">Rationale</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {proposal.map(r => (
                      <tr key={r.id} className="align-top hover:bg-white/3">
                        <td className="p-3 font-mono text-[10px] text-slate-500">{r.id}</td>
                        <td className="p-3 text-slate-200 text-xs">{r.group_id}</td>
                        <td className="p-3 whitespace-pre-wrap text-slate-100/90 text-xs leading-relaxed">{r.original}</td>
                        <td className="p-3">
                          {r.action.startsWith('Merge') ? (
                            <span className="italic text-slate-500 text-xs">(merged)</span>
                          ) : (
                            <textarea
                              className="w-full min-h-[72px] rounded-xl bg-slate-800/60 border border-white/10 px-2 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                              value={r.proposed}
                              onChange={e => updateAction(r.id, r.action, e.target.value)}
                            />
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            className="w-full rounded-lg bg-slate-800/60 border border-white/10 px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                            value={r.action}
                            onChange={e => updateAction(r.id, e.target.value)}
                          >
                            <option className="bg-slate-900" value="Keep">Keep</option>
                            <option className="bg-slate-900" value="Rewrite">Rewrite</option>
                            <option className="bg-slate-900" value={`Merge->${r.id}`}>Merge (self)</option>
                            <option className="bg-slate-900" value="Drop">Drop</option>
                            {r.action.startsWith('Merge->') && <option className="bg-slate-900" value={r.action}>{r.action}</option>}
                          </select>
                        </td>
                        <td className="p-3 text-[11px] leading-relaxed text-slate-400">{r.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* Final Results */}
        {finalList.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">4.</span> Canonical List ({finalList.length})
            </h2>
            <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-xl shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_32px_-6px_rgba(0,0,0,0.5)]">
              <ol className="list-decimal pl-6 space-y-2 text-sm marker:text-fuchsia-300/70">
                {finalList.map(r => (
                  <li key={r.id} className="text-slate-200/90 leading-relaxed">{r.text}</li>
                ))}
              </ol>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 text-emerald-200 text-sm">
              🎉 Cleanup complete — ready for downstream mapping & prioritisation.
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
