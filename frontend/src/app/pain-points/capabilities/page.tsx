"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection } from "@/types/excel";
import { PageShell, GlassCard, HeaderBand, GradientTitle, PrimaryButton, SecondaryButton } from "@/components/ui";

interface CapMapRes {
  columns: string[];
  rows: Array<Record<string, string>>;
}

export default function CapabilityMapping() {
  const [idCol, setIdCol] = useState("");
  const [textCols, setTextCols] = useState("");
  const [capabilities, setCapabilities] = useState("");
  const [context, setContext] = useState("");
  const [batch, setBatch] = useState(15);
  const [sheet, setSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CapMapRes | null>(null);
  const [excel, setExcel] = useState<StructuredExcelSelection>({ file: null, sheet: null, headers: [], textColumns: [] });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setLoading(true); setError(""); setResult(null);
  if (!excel.file) { setError("Select a file"); setLoading(false); return; }
    const fd = new FormData();
  fd.append("file", excel.file);
    fd.append("id_column", idCol);
  fd.append("text_columns", JSON.stringify((excel.textColumns.length? excel.textColumns : textCols.split(",").map(s=>s.trim()).filter(Boolean)) ));
    fd.append("capabilities_text", capabilities);
    fd.append("additional_context", context);
    fd.append("batch_size", String(batch));
  if (excel.sheet || sheet) fd.append("sheet_name", excel.sheet || sheet);
    const res = await fetch("/api/ai/pain-points/capabilities/map", { method: "POST", body: fd });
    if (!res.ok) { setError(`HTTP ${res.status}`); setLoading(false); return; }
    const json = (await res.json()) as CapMapRes;
    setResult(json);
    setLoading(false);
  }

  async function downloadXlsx() {
  if (!excel.file) { setError("Select a file first"); return; }
    const fd = new FormData();
  fd.append("file", excel.file);
    fd.append("id_column", idCol);
  fd.append("text_columns", JSON.stringify((excel.textColumns.length? excel.textColumns : textCols.split(",").map(s=>s.trim()).filter(Boolean)) ));
    fd.append("capabilities_text", capabilities);
    fd.append("additional_context", context);
    fd.append("batch_size", String(batch));
  if (excel.sheet || sheet) fd.append("sheet_name", excel.sheet || sheet);
    const res = await fetch("/api/ai/pain-points/capabilities/map.xlsx", { method: "POST", body: fd });
    if (!res.ok) { setError(`Download failed: HTTP ${res.status}`); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "pain_point_capability_mapping.xlsx"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PageShell max="2xl">
      {/* Header */}
      <header className="space-y-4">
        <HeaderBand label="AI Mapping Workflow" />
        <GradientTitle>🧭 Pain Point → Capability Mapping</GradientTitle>
        <p className="text-lg md:text-xl text-slate-300 max-w-3xl leading-relaxed">
          Upload pain points and paste your capability catalogue (IDs + names/descriptions). We’ll map each pain point to the most relevant capability ID.
        </p>
      </header>

      {/* Form */}
      <form id="cap-map-form" className="space-y-8" onSubmit={onSubmit}>
        <GlassCard>
          <div className="grid grid-cols-1 gap-8">
            <div className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Pain Points Dataset</h2>
              <label className="block text-sm font-medium text-slate-200">Upload CSV/XLSX</label>
              <ExcelDataInput mode="id-text" value={excel} onChange={setExcel} />
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">Pain Point ID column</label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-800/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                    value={idCol}
                    onChange={e=>setIdCol(e.target.value)}
                    placeholder="e.g. Pain_Point_ID"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-200">Text columns (comma-separated)</label>
                  <input
                    type="text"
                    className="w-full rounded-xl bg-slate-800/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                    value={textCols}
                    onChange={e=>setTextCols(e.target.value)}
                    placeholder="e.g. Title,Description"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">Sheet name (optional)</label>
                <input
                  type="text"
                  className="w-full rounded-xl bg-slate-800/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                  value={sheet}
                  onChange={e=>setSheet(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm uppercase tracking-wider text-slate-400 font-semibold">Capabilities Catalogue</h2>
              <label className="block text-sm font-medium text-slate-200">Capability list (IDs + names/descriptions)</label>
              <div className="relative">
                <textarea
                  className="w-full h-44 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner"
                  value={capabilities}
                  onChange={e=>setCapabilities(e.target.value)}
                  placeholder={"e.g.\nCAP-01: Customer Onboarding\nCAP-02: Billing & Invoicing\n..."}
                />
                <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
              </div>
              <label className="block text-sm font-medium text-slate-200">Additional context</label>
              <div className="relative">
                <textarea
                  className="w-full h-24 rounded-2xl bg-gradient-to-br from-slate-800/60 to-slate-900/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-transparent shadow-inner"
                  value={context}
                  onChange={e=>setContext(e.target.value)}
                />
                <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/5" />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-200">Batch size</label>
                <input
                  type="number"
                  className="w-40 rounded-xl bg-slate-800/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  value={batch}
                  onChange={e=>setBatch(parseInt(e.target.value||"15",10))}
                />
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <PrimaryButton disabled={loading} loading={loading}>Map capabilities</PrimaryButton>
                <SecondaryButton type="button" onClick={downloadXlsx}>⬇️ Download XLSX</SecondaryButton>
              </div>
              {error && (
                <GlassCard padding="sm" className="border-rose-500/30 bg-rose-600/10 text-sm text-rose-200">❌ {error}</GlassCard>
              )}
            </div>
          </div>
        </GlassCard>
      </form>

      {/* Results */}
      {result && (
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Results</h2>
          <GlassCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5">
                  <tr className="text-left text-slate-300">
                    {result.columns.map(c => (<th className="p-3 font-semibold text-xs uppercase tracking-wide" key={c}>{c}</th>))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {result.rows.map((r, idx)=> (
                    <tr key={idx} className="align-top hover:bg-white/3">
                      {result.columns.map(c => (<td key={c} className="p-3 text-slate-200 align-top whitespace-pre-wrap">{String(r[c] ?? "")}</td>))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </section>
      )}
    </PageShell>
  );
}
