"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";
import { PageShell, GlassCard, HeaderBand, GradientTitle, PrimaryButton, SecondaryButton, ProgressBar, StatusPill } from "@/components/ui";

type MappingRecord = { 
  physical_id:string; physical_name:string; logical_id:string; logical_name:string; 
  similarity:number; rationale:string; uncertainty:boolean;
  // Debug fields (v0.1.3+)
  model_logical_id?:string; auto_substituted?:boolean; mismatch_reason?:string;
};
interface ResponseData { mappings: MappingRecord[]; summary: Record<string, any> }

export default function PhysicalLogicalMappingPage() {
  const [physicalExcel, setPhysicalExcel] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [logicalExcel, setLogicalExcel] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [context, setContext] = useState("");
  // LLM-only mode (heuristic removed)
  const useLLM = true;
  const [stream, setStream] = useState(true);
  const [maxConcurrency, setMaxConcurrency] = useState(4);
  const [showDebugFields, setShowDebugFields] = useState(false);
  const [progress, setProgress] = useState<{processed:number; total:number}>({processed:0,total:0});
  const [data, setData] = useState<ResponseData|null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  const ready = physicalExcel.file && physicalExcel.idColumn && physicalExcel.textColumns.length>0 && logicalExcel.file && logicalExcel.idColumn && logicalExcel.textColumns.length>0;

  // Validation helper for results
  function validateResults(mappings: MappingRecord[], summary: Record<string, any>) {
    const postWarnings: string[] = [];
    const autoSubs = mappings.filter(m => m.auto_substituted).length;
    const uncertain = mappings.filter(m => m.uncertainty).length;
    
    if (autoSubs > 0) postWarnings.push(`${autoSubs} mappings required auto-substitution (check model_logical_id vs final mapping)`);
    if (uncertain > mappings.length * 0.3) postWarnings.push(`High uncertainty rate: ${uncertain}/${mappings.length} mappings flagged for review`);
    if (!summary.mece_physical_coverage) postWarnings.push("MECE violation: Not all physical applications were mapped");
    
    if (postWarnings.length > 0) {
      setValidationWarnings(prev => [...prev, ...postWarnings]);
    }
  }

  // Statistics calculation
  function getStatistics() {
    if (!data) return null;
    const autoSubs = data.mappings.filter(m => m.auto_substituted).length;
    const modelMismatches = data.mappings.filter(m => m.model_logical_id && m.model_logical_id !== m.logical_id).length;
    const avgSimilarity = data.mappings.reduce((sum, m) => sum + m.similarity, 0) / data.mappings.length;
    
    return {
      autoSubs,
      modelMismatches, 
      avgSimilarity: avgSimilarity.toFixed(3),
      lowSimilarity: data.mappings.filter(m => m.similarity < 0.3).length
    };
  }

  async function run(e:React.FormEvent){
    e.preventDefault(); setErr(""); setLoading(true); setData(null); setValidationWarnings([]);
    
    // Pre-validation warnings
    const warnings: string[] = [];
    if (maxConcurrency > 10) warnings.push("High concurrency may increase API costs and rate limit risks");
    if (context.length > 500) warnings.push("Long context may increase token usage");
    setValidationWarnings(warnings);
    try {
      // Build multipart form for file-based endpoint
      const fd = new FormData();
      fd.append("physical_file", physicalExcel.file!);
      fd.append("physical_id_column", physicalExcel.idColumn!);
      fd.append("physical_text_columns", JSON.stringify(physicalExcel.textColumns));
      fd.append("logical_file", logicalExcel.file!);
      fd.append("logical_id_column", logicalExcel.idColumn!);
      fd.append("logical_text_columns", JSON.stringify(logicalExcel.textColumns));
      if(physicalExcel.sheet) fd.append("physical_sheet", physicalExcel.sheet);
      if(logicalExcel.sheet) fd.append("logical_sheet", logicalExcel.sheet);
      if(physicalExcel.headerRowIndex != null) fd.append("physical_header_row_index", String(physicalExcel.headerRowIndex));
      if(logicalExcel.headerRowIndex != null) fd.append("logical_header_row_index", String(logicalExcel.headerRowIndex));
      fd.append("additional_context", context);
  // no uncertainty threshold (removed)
  if(useLLM){
        fd.append("max_concurrency", String(maxConcurrency));
        if(stream){
          const res = await fetch("/api/ai/applications/physical-logical/map-from-files-llm-stream", { method:"POST", body: fd });
          if(!res.ok || !res.body){
            const txt = await res.text(); throw new Error(txt || "Streaming failed");
          }
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
            for(;;){
              const {value, done} = await reader.read();
              if(done) break;
              buffer += decoder.decode(value, {stream:true});
              const parts = buffer.split(/\n\n/);
              buffer = parts.pop() || "";
              for(const part of parts){
                if(!part.startsWith("data:")) continue;
                const jsonStr = part.slice(5).trim();
                if(!jsonStr) continue;
                try {
                  const evt = JSON.parse(jsonStr);
                  if(evt.type === 'start'){
                    setProgress({processed:0,total:evt.total||0});
                  } else if(evt.type === 'progress'){
                    setProgress({processed:evt.processed,total:evt.total});
                  } else if(evt.type === 'complete'){
                    setData({mappings:evt.mappings, summary:evt.summary});
                    // Post-processing validation
                    validateResults(evt.mappings, evt.summary);
                  }
                } catch {}
              }
            }
        } else {
          const res = await fetch("/api/ai/applications/physical-logical/map-from-files-llm", { method:"POST", body: fd });
          const j = await res.json(); 
          if(!res.ok) throw new Error(j?.detail || "Request failed"); 
          setData(j as ResponseData);
          validateResults(j.mappings, j.summary);
        }
      } else {
        const res = await fetch("/api/ai/applications/physical-logical/map-from-files", { method:"POST", body: fd });
        const j = await res.json(); if(!res.ok) throw new Error(j?.detail || "Request failed"); setData(j as ResponseData);
      }
    } catch(e){ setErr(e instanceof Error? e.message : "Request failed"); } finally { setLoading(false); }
  }

  async function downloadExcel(){
    try {
      if(!data) return;
      const payload = JSON.stringify({ mappings: data.mappings, summary: data.summary });
      const res = await fetch("/api/ai/applications/physical-logical/export.xlsx", { method:"POST", body: payload, headers: {"Content-Type": "application/json"} });
      if(!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "physical_logical_mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch(e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    }
  }

  async function downloadCsv() {
    if (!data) return;
    const headers = ["Physical ID", "Physical Name", "Logical ID", "Logical Name", "Similarity", "Rationale", "Uncertain"];
    if (showDebugFields) headers.push("Model ID", "Auto Substituted", "Mismatch Reason");
    
    const rows = data.mappings.map(m => {
      const row = [m.physical_id, m.physical_name, m.logical_id, m.logical_name, m.similarity.toString(), `"${m.rationale.replace(/"/g, '""')}"`, m.uncertainty.toString()];
      if (showDebugFields) row.push(m.model_logical_id || "", m.auto_substituted?.toString() || "false", `"${(m.mismatch_reason || "").replace(/"/g, '""')}"`);
      return row.join(",");
    });
    
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "physical_logical_mapping.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const progressPercent = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <PageShell max="2xl">
      {/* Header */}
      <header className="space-y-4">
        <HeaderBand label="AI Mapping Workflow" />
        <GradientTitle>🔗 Physical → Logical Application Mapping</GradientTitle>
        <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
          Map each physical application to a single logical application (MECE). Uses LLM analysis with transparent reasoning, streaming progress, and export-ready results.
        </p>
      </header>

      {/* Validation Warnings */}
      {validationWarnings.length > 0 && (
        <GlassCard padding="md" className="border-amber-400/30 bg-amber-500/10">
          <h3 className="font-semibold text-amber-200 mb-2">Validation Warnings</h3>
          <ul className="text-sm text-amber-100/90 space-y-1">
            {validationWarnings.map((warning, i) => <li key={i}>• {warning}</li>)}
          </ul>
        </GlassCard>
      )}

      {/* Form Card */}
      <form onSubmit={run} className="space-y-8">
        <GlassCard>
            <div className="grid grid-cols-1 gap-8">
              <div>
                <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">Logical Applications Dataset</h2>
                <ExcelDataInput
                  mode="id-text"
                  value={logicalExcel}
                  onChange={setLogicalExcel}
                  labels={{ id: "Logical App ID", text: "Description Columns" }}
                  required
                />
              </div>
              <div>
                <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold mb-2">Physical Applications Dataset</h2>
                <ExcelDataInput
                  mode="id-text"
                  value={physicalExcel}
                  onChange={setPhysicalExcel}
                  labels={{ id: "Physical App ID", text: "Description Columns" }}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200">Additional Context</label>
                <div className="relative">
                  <textarea
                    value={context}
                    onChange={e=>setContext(e.target.value)}
                    className="w-full h-32 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner"
                    placeholder="Business context, scope guidance..."
                  />
                  <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
                </div>
                <p className="text-xs text-slate-500">Keep it concise (1–4 sentences). Helps with disambiguation.</p>
              </div>
              <div className="space-y-3">
                <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/10 p-4">
                  <p className="text-xs text-indigo-200">LLM mapping active. Each physical app triggers a model call.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                    <label className="flex items-center gap-2">Max Concurrency
                      <input
                        type="number" min={1} max={100} value={maxConcurrency}
                        onChange={e=>setMaxConcurrency(Math.min(100, Math.max(1, Number(e.target.value)||1)))}
                        className="w-20 px-2 py-1 rounded-lg bg-slate-900/60 border border-white/10"
                      />
                    </label>
                    <span className="text-[10px] text-slate-500">1–100 (higher may increase API cost/rate limits)</span>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={stream} onChange={e=>setStream(e.target.checked)} /> Stream Progress
                    </label>
                    {stream && (
                      <StatusPill className="px-2">{progress.processed}/{progress.total} processed</StatusPill>
                    )}
                  </div>
                  {loading && stream && (
                    <ProgressBar className="mt-3" value={progressPercent} />
                  )}
                  <div className="pt-3">
                    <label className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={showDebugFields} onChange={e=>setShowDebugFields(e.target.checked)} />
                      Show debug fields (model ID, substitutions, mismatch reasons)
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryButton disabled={loading || !ready} loading={loading} icon={<span>🔍</span>}>
                Map Physical → Logical
              </PrimaryButton>
              {data && (
                <>
                  <SecondaryButton type="button" onClick={downloadExcel}>⬇️ Download Excel</SecondaryButton>
                  <SecondaryButton type="button" onClick={downloadCsv}>⬇️ Download CSV</SecondaryButton>
                  <SecondaryButton type="button" onClick={()=>setData(null)}>🔄 New Session</SecondaryButton>
                </>
              )}
            </div>
        </GlassCard>
      </form>

      {/* Error */}
      {err && <GlassCard padding="md" className="border-rose-500/30 bg-rose-600/10 text-sm text-rose-200">❌ {err}</GlassCard>}

      {/* Results */}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-xs">
            <StatusPill>Physical: <strong className="text-slate-50">{data.summary.physical}</strong></StatusPill>
            <StatusPill>Logical: <strong className="text-slate-50">{data.summary.logical}</strong></StatusPill>
            <StatusPill>Mapped: <strong className="text-slate-50">{data.summary.mapped}</strong></StatusPill>
            <StatusPill>Uncertain: <strong className="text-slate-50">{data.summary.uncertain}</strong></StatusPill>
            <StatusPill>MECE Coverage: <strong className="text-slate-50">{data.summary.mece_physical_coverage?"Yes":"No"}</strong></StatusPill>
            {(() => { const stats = getStatistics(); return stats ? (
              <StatusPill>Avg Similarity: <strong className="text-slate-50">{stats.avgSimilarity}</strong></StatusPill>
            ) : null; })()}
          </div>
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm table-auto">
                <thead className="bg-white/5">
                  <tr className="text-left text-slate-300">
                    <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[26%]">Physical (ID)</th>
                    <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[26%]">Logical (ID)</th>
                    <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[10%]">Similarity</th>
                    <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[28%]">Rationale</th>
                    <th className="p-3 font-semibold text-xs uppercase tracking-wide w-[10%]">Uncertain</th>
                    {showDebugFields && (
                      <>
                        <th className="p-3 font-semibold text-xs uppercase tracking-wide bg-yellow-900/20 w-[10%]">Model ID</th>
                        <th className="p-3 font-semibold text-xs uppercase tracking-wide bg-yellow-900/20 w-[8%]">Auto Sub</th>
                        <th className="p-3 font-semibold text-xs uppercase tracking-wide bg-yellow-900/20 w-[18%]">Mismatch</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.mappings.map(m => (
                    <tr key={m.physical_id} className="align-top hover:bg-white/3">
                      <td className="p-3"><div className="font-medium text-slate-100/90">{m.physical_name}</div><div className="text-xs text-slate-500">{m.physical_id}</div></td>
                      <td className="p-3"><div className="font-medium text-slate-100/90">{m.logical_name}</div><div className="text-xs text-slate-500">{m.logical_id}</div></td>
                      <td className="p-3 tabular-nums text-slate-200">{m.similarity.toFixed(3)}</td>
                      <td className="p-3 whitespace-pre-wrap text-slate-300">{m.rationale}</td>
                      <td className="p-3">{m.uncertainty && <StatusPill variant="warning">Check</StatusPill>}</td>
                      {showDebugFields && (
                        <>
                          <td className="p-3 bg-yellow-400/10 text-xs font-mono text-yellow-200">{(m as any).model_logical_id || '-'}</td>
                          <td className="p-3 bg-yellow-400/10 text-xs text-yellow-200">{(m as any).auto_substituted ? 'Yes' : 'No'}</td>
                          <td className="p-3 bg-yellow-400/10 text-xs max-w-xs whitespace-pre-wrap text-yellow-200">{(m as any).mismatch_reason || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}
    </PageShell>
  );
}
