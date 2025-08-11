"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";

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

  return (
    <main>
      <div className="mx-auto max-w-6xl space-y-8">
        <h1 className="text-3xl font-bold">Physical → Logical Application Mapping</h1>
        <p className="text-sm text-gray-600 max-w-3xl">Map each physical application to exactly one logical application (MECE). Uses LLM analysis with debug transparency for ID matching and substitution decisions.</p>
        
        {validationWarnings.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h3 className="font-medium text-amber-800 mb-2">Validation Warnings</h3>
            <ul className="text-sm text-amber-700 space-y-1">
              {validationWarnings.map((warning, i) => <li key={i}>• {warning}</li>)}
            </ul>
          </div>
        )}
        <form onSubmit={run} className="space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="font-semibold mb-2">Physical Applications Dataset</h2>
              <ExcelDataInput
                mode="id-text"
                value={physicalExcel}
                onChange={setPhysicalExcel}
                labels={{ id: "Physical App ID", text: "Description Columns" }}
                required
              />
            </div>
            <div>
              <h2 className="font-semibold mb-2">Logical Applications Dataset</h2>
              <ExcelDataInput
                mode="id-text"
                value={logicalExcel}
                onChange={setLogicalExcel}
                labels={{ id: "Logical App ID", text: "Description Columns" }}
                required
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Additional Context</label>
              <textarea value={context} onChange={e=>setContext(e.target.value)} className="w-full p-2 rounded border border-black/10 text-sm" rows={3} placeholder="Business context, scope guidance..." />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-indigo-700">LLM mapping active. Each physical app triggers a model call.</p>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <label className="flex items-center gap-1">Max Concurrency
                  <input type="number" min={1} max={100} value={maxConcurrency} onChange={e=>setMaxConcurrency(Math.min(100, Math.max(1, Number(e.target.value)||1)))} className="w-20 px-1 py-0.5 border rounded" />
                </label>
                <span className="text-[10px] text-gray-500">1–100 (higher may increase API cost/rate limits)</span>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={stream} onChange={e=>setStream(e.target.checked)} /> Stream Progress
                </label>
                {stream && <span>{progress.processed}/{progress.total} processed</span>}
              </div>
              <div className="pt-2">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={showDebugFields} onChange={e=>setShowDebugFields(e.target.checked)} />
                  Show debug fields (model ID, substitutions, mismatch reasons)
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button disabled={loading || !ready} className="px-4 py-2 rounded bg-indigo-600 text-white disabled:opacity-50">{loading?"Mapping...":"Map Physical → Logical"}</button>
            {data && <button type="button" onClick={downloadExcel} className="px-4 py-2 rounded border border-black/10 hover:bg-black/5">Download Excel</button>}
            {data && <button type="button" onClick={()=>setData(null)} className="px-4 py-2 rounded border border-black/10 hover:bg-black/5">New Session</button>}
          </div>
        </form>
        {err && <div className="p-3 border border-red-200 text-red-700 rounded">{err}</div>}
        {data && (
          <div className="space-y-4">
            <div className="text-sm flex flex-wrap gap-3">
              <span className="px-2 py-1 rounded bg-black/5">Physical: {data.summary.physical}</span>
              <span className="px-2 py-1 rounded bg-black/5">Logical: {data.summary.logical}</span>
              <span className="px-2 py-1 rounded bg-black/5">Mapped: {data.summary.mapped}</span>
              <span className="px-2 py-1 rounded bg-black/5">Uncertain: {data.summary.uncertain}</span>
              <span className="px-2 py-1 rounded bg-black/5">MECE Coverage: {data.summary.mece_physical_coverage?"Yes":"No"}</span>
            </div>
            <div className="rounded-xl border border-black/10 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-black/5 text-left">
                    <th className="p-2">Physical (ID)</th>
                    <th className="p-2">Logical (ID)</th>
                    <th className="p-2">Similarity</th>
                    <th className="p-2">Rationale</th>
                    <th className="p-2">Uncertain</th>
                    {showDebugFields && (
                      <>
                        <th className="p-2 bg-yellow-100">Model ID</th>
                        <th className="p-2 bg-yellow-100">Auto Sub</th>
                        <th className="p-2 bg-yellow-100">Mismatch</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map(m => (
                    <tr key={m.physical_id} className="odd:bg-black/5 align-top">
                      <td className="p-2"><div className="font-medium">{m.physical_name}</div><div className="text-xs text-black/60">{m.physical_id}</div></td>
                      <td className="p-2"><div className="font-medium">{m.logical_name}</div><div className="text-xs text-black/60">{m.logical_id}</div></td>
                      <td className="p-2 tabular-nums">{m.similarity.toFixed(3)}</td>
                      <td className="p-2 max-w-sm whitespace-pre-wrap">{m.rationale}</td>
                      <td className="p-2">{m.uncertainty && <span className="text-xs px-2 py-1 rounded bg-amber-200 text-amber-900">Check</span>}</td>
                      {showDebugFields && (
                        <>
                          <td className="p-2 bg-yellow-50 text-xs font-mono">{(m as any).model_logical_id || '-'}</td>
                          <td className="p-2 bg-yellow-50 text-xs">{(m as any).auto_substituted ? 'Yes' : 'No'}</td>
                          <td className="p-2 bg-yellow-50 text-xs max-w-xs whitespace-pre-wrap">{(m as any).mismatch_reason || '-'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
