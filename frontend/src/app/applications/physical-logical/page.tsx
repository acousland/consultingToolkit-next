"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";

type MappingRecord = { physical_id:string; physical_name:string; logical_id:string; logical_name:string; similarity:number; rationale:string; uncertainty:boolean };
interface ResponseData { mappings: MappingRecord[]; summary: Record<string, any> }

export default function PhysicalLogicalMappingPage() {
  const [physicalExcel, setPhysicalExcel] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [logicalExcel, setLogicalExcel] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [context, setContext] = useState("");
  const [threshold, setThreshold] = useState(0.22);
  const [data, setData] = useState<ResponseData|null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const ready = physicalExcel.file && physicalExcel.idColumn && physicalExcel.textColumns.length>0 && logicalExcel.file && logicalExcel.idColumn && logicalExcel.textColumns.length>0;

  async function run(e:React.FormEvent){
    e.preventDefault(); setErr(""); setLoading(true); setData(null);
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
      fd.append("uncertainty_threshold", String(threshold));
      const res = await fetch("/api/ai/applications/physical-logical/map-from-files", { method:"POST", body: fd });
      const j = await res.json(); if(!res.ok) throw new Error(j?.detail || "Request failed"); setData(j as ResponseData);
    } catch(e){ setErr(e instanceof Error? e.message : "Request failed"); } finally { setLoading(false); }
  }

  async function downloadExcel(){
    try {
      if(!ready) return; const fd = new FormData();
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
      fd.append("uncertainty_threshold", String(threshold));
      const res = await fetch("/api/ai/applications/physical-logical/map.xlsx", { method:"POST", body: fd });
      if(!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "physical_logical_mapping.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  return (
    <main>
      <div className="mx-auto max-w-6xl space-y-8">
        <h1 className="text-3xl font-bold">Physical → Logical Application Mapping</h1>
        <p className="text-sm text-black/70 max-w-3xl">Map each physical application to exactly one logical application (MECE). Similarity is heuristic (lexical) in this MVP; low similarity rows are flagged as uncertain for manual review.</p>
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
              <label className="text-sm font-medium flex items-center gap-2">Uncertainty Threshold <span className="text-xs text-black/50">({threshold.toFixed(2)})</span></label>
              <input type="range" min={0} max={0.8} step={0.01} value={threshold} onChange={e=>setThreshold(parseFloat(e.target.value))} className="w-full" />
              <p className="text-xs text-black/60">Rows with similarity below threshold are flagged for manual validation.</p>
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
