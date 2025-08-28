"use client";
import React, { useEffect, useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection } from "@/types/excel";
import { 
  PageShell, 
  GlassCard, 
  HeaderBand, 
  GradientTitle, 
  PrimaryButton, 
  SecondaryButton, 
  StatusPill, 
  ProgressBar 
} from "@/components/ui";

type ThemeMapRes = { columns: string[]; rows: Array<Record<string, string>> };

export default function PainPointThemesPage() {
  const [excel, setExcel] = useState<StructuredExcelSelection>({ file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined });
  const [context, setContext] = useState<string>("");
  const [batch, setBatch] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ThemeMapRes | null>(null);
  const [downloading, setDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);

  // Default themes and perspectives
  const defaultThemes = [
    "Process Efficiency", "Technology", "Communication", "Resource Management", 
    "Training & Development", "Quality Control", "Customer Experience", "Compliance",
    "Data Management", "Integration", "Security", "Performance"
  ];
  
  const defaultPerspectives = [
    "Strategic", "Operational", "Technical", "Financial", "Customer", 
    "Employee", "Regulatory", "Risk", "Innovation", "Quality"
  ];

  const [themes, setThemes] = useState<{ name: string; enabled: boolean }[]>(
    defaultThemes.map(name => ({ name, enabled: true }))
  );
  const [perspectives, setPerspectives] = useState<{ name: string; enabled: boolean }[]>(
    defaultPerspectives.map(name => ({ name, enabled: true }))
  );
  const [newTheme, setNewTheme] = useState<string>("");
  const [newPerspective, setNewPerspective] = useState<string>("");

  const canSubmit = !!excel.file && !!excel.idColumn && excel.textColumns.length > 0 && !loading;

  // Helper functions for theme/perspective management
  function toggleTheme(index: number) {
    setThemes(prev => prev.map((theme, i) => 
      i === index ? { ...theme, enabled: !theme.enabled } : theme
    ));
  }

  function togglePerspective(index: number) {
    setPerspectives(prev => prev.map((perspective, i) => 
      i === index ? { ...perspective, enabled: !perspective.enabled } : perspective
    ));
  }

  function addTheme() {
    if (newTheme.trim() && !themes.some(t => t.name.toLowerCase() === newTheme.trim().toLowerCase())) {
      setThemes(prev => [...prev, { name: newTheme.trim(), enabled: true }]);
      setNewTheme("");
    }
  }

  function addPerspective() {
    if (newPerspective.trim() && !perspectives.some(p => p.name.toLowerCase() === newPerspective.trim().toLowerCase())) {
      setPerspectives(prev => [...prev, { name: newPerspective.trim(), enabled: true }]);
      setNewPerspective("");
    }
  }

  function removeTheme(index: number) {
    setThemes(prev => prev.filter((_, i) => i !== index));
  }

  function removePerspective(index: number) {
    setPerspectives(prev => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setGenerationProgress(0);
    
    try {
      const fd = new FormData();
      if (!excel.file) throw new Error("No file selected");
      fd.append("file", excel.file);
      fd.append("id_column", excel.idColumn || "");
      fd.append("text_columns", JSON.stringify(excel.textColumns));
      fd.append("additional_context", context);
      fd.append("batch_size", String(batch));
      if (excel.sheet) fd.append("sheet_name", excel.sheet);
      
      // Add enabled themes and perspectives
      const enabledThemes = themes.filter(t => t.enabled).map(t => t.name);
      const enabledPerspectives = perspectives.filter(p => p.enabled).map(p => p.name);
      fd.append("themes", JSON.stringify(enabledThemes));
      fd.append("perspectives", JSON.stringify(enabledPerspectives));
      
      const res = await fetch("/api/ai/pain-points/themes/map", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      
      // Handle streaming response with progress updates
      const total = Number(res.headers.get("content-length") || 0);
      if (res.body && total > 0) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            setGenerationProgress(Math.round((received / total) * 100));
          }
        }
        
        // Reconstruct and parse the response
        const blob = new Blob(chunks.map(c => c as BlobPart));
        const text = await blob.text();
        const json = JSON.parse(text) as ThemeMapRes;
        setResult(json);
      } else {
        // Fallback for responses without content-length
        const json = (await res.json()) as ThemeMapRes;
        setResult(json);
        setGenerationProgress(100);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to generate themes";
      setError(message);
    } finally {
      setLoading(false);
      setGenerationProgress(null);
    }
  }

  // Persist and restore selections per filename
  useEffect(() => {
    const key = excel.file ? `themes:${excel.file.name}` : null;
    if (!key) return;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const obj = JSON.parse(saved) as { idColumn?: string; textColumns?: string[] };
        setExcel(prev => ({ ...prev, idColumn: obj.idColumn ?? prev.idColumn, textColumns: obj.textColumns ?? prev.textColumns }));
      } catch {}
    }
  }, [excel.file]);

  useEffect(() => {
    const key = excel.file ? `themes:${excel.file.name}` : null;
    if (!key) return;
    localStorage.setItem(key, JSON.stringify({ idColumn: excel.idColumn, textColumns: excel.textColumns }));
  }, [excel.file, excel.idColumn, excel.textColumns]);

  async function downloadXlsx() {
    try {
      if (!excel.file) {
        setError("Select a file first");
        return;
      }
      setDownloading(true);
      setDownloadProgress(null);
      const fd = new FormData();
      fd.append("file", excel.file);
      fd.append("id_column", excel.idColumn || "");
      fd.append("text_columns", JSON.stringify(excel.textColumns));
      fd.append("additional_context", context);
      fd.append("batch_size", String(batch));
      if (excel.sheet) fd.append("sheet_name", excel.sheet);
      
      // Add enabled themes and perspectives
      const enabledThemes = themes.filter(t => t.enabled).map(t => t.name);
      const enabledPerspectives = perspectives.filter(p => p.enabled).map(p => p.name);
      fd.append("themes", JSON.stringify(enabledThemes));
      fd.append("perspectives", JSON.stringify(enabledPerspectives));
      
      const res = await fetch("/api/ai/pain-points/themes/map.xlsx", { method: "POST", body: fd });
      if (!res.ok) { setError(`Download failed: HTTP ${res.status}`); return; }
      const total = Number(res.headers.get("content-length") || 0);
      if (res.body && total > 0) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
                      received += value.byteLength;
            setDownloadProgress(Math.round((received / total) * 100));
          }
        }
  const blob = new Blob(chunks.map(c => c as BlobPart), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
  a.href = url; a.download = "theme_perspective_mapping.xlsx"; a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "theme_perspective_mapping.xlsx"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Download failed";
      setError(message);
    } finally {
      setDownloading(false);
      setDownloadProgress(null);
    }
  }

  return (
    <PageShell>
      <HeaderBand label="Pain Point Analysis" />
      <GradientTitle>Theme & Perspective Mapping</GradientTitle>
      <p className="text-zinc-400 text-lg leading-relaxed mb-8">
        Upload pain points (CSV/XLSX), pick the ID and text columns, then generate theme & perspective mappings.
      </p>

      <GlassCard className="mb-8">
        <form onSubmit={onSubmit} className="space-y-6">
          <ExcelDataInput mode="id-text" value={excel} onChange={setExcel} />
          
          {excel.headers.length > 0 && (
            <div className="space-y-6">
              {/* Theme and Perspective Selection - Only show when columns are selected */}
              {excel.idColumn && excel.textColumns.length > 0 && (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Themes */}
                  <GlassCard innerHairline className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-200 mb-4">Available Themes</h3>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {themes.map((theme, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleTheme(index)}
                              className={`px-3 py-1 rounded-full text-sm transition-all ${
                                theme.enabled 
                                  ? "bg-emerald-600/80 text-white border border-emerald-500/50" 
                                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50"
                              }`}
                            >
                              {theme.name}
                            </button>
                            {index >= defaultThemes.length && (
                              <button
                                type="button"
                                onClick={() => removeTheme(index)}
                                className="text-red-400 hover:text-red-300 text-xs"
                                title="Remove custom theme"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newTheme}
                          onChange={(e) => setNewTheme(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTheme())}
                          placeholder="Add custom theme..."
                          className="flex-1 px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        />
                        <SecondaryButton type="button" onClick={addTheme} disabled={!newTheme.trim()}>
                          Add
                        </SecondaryButton>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Perspectives */}
                  <GlassCard innerHairline className="p-6">
                    <h3 className="text-lg font-semibold text-zinc-200 mb-4">Available Perspectives</h3>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {perspectives.map((perspective, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => togglePerspective(index)}
                              className={`px-3 py-1 rounded-full text-sm transition-all ${
                                perspective.enabled 
                                  ? "bg-blue-600/80 text-white border border-blue-500/50" 
                                  : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/50"
                              }`}
                            >
                              {perspective.name}
                            </button>
                            {index >= defaultPerspectives.length && (
                              <button
                                type="button"
                                onClick={() => removePerspective(index)}
                                className="text-red-400 hover:text-red-300 text-xs"
                                title="Remove custom perspective"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newPerspective}
                          onChange={(e) => setNewPerspective(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPerspective())}
                          placeholder="Add custom perspective..."
                          className="flex-1 px-3 py-2 text-sm bg-black/20 border border-white/10 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                        <SecondaryButton type="button" onClick={addPerspective} disabled={!newPerspective.trim()}>
                          Add
                        </SecondaryButton>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}

              <GlassCard innerHairline className="p-6">
                <h3 className="text-lg font-semibold text-zinc-200 mb-4">Additional Context</h3>
                <textarea 
                  className="w-full h-24 p-3 bg-black/20 border border-white/10 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50" 
                  value={context} 
                  onChange={(e) => setContext(e.target.value)} 
                  placeholder="Optional guidance for thematic nuance" 
                />
              </GlassCard>

              <GlassCard innerHairline className="p-6">
                <h3 className="text-lg font-semibold text-zinc-200 mb-4">Processing Configuration</h3>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-2">Batch size</label>
                    <input 
                      type="number" 
                      min={1} 
                      className="w-32 p-3 bg-black/20 border border-white/10 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50" 
                      value={batch} 
                      onChange={(e) => setBatch(parseInt(e.target.value || "10", 10))} 
                    />
                  </div>
                  <div className="flex gap-3">
                    <PrimaryButton 
                      disabled={!canSubmit || downloading} 
                      loading={loading}
                      onClick={() => {}}
                      type="submit"
                    >
                      {loading ? "Generating..." : "Generate mappings"}
                    </PrimaryButton>
                    <SecondaryButton 
                      type="button" 
                      onClick={() => { 
                        setExcel(prev => ({ ...prev, idColumn: undefined, textColumns: [] })); 
                        setResult(null); 
                        setError(null);
                        setGenerationProgress(null);
                        // Reset themes and perspectives to defaults
                        setThemes(defaultThemes.map(name => ({ name, enabled: true })));
                        setPerspectives(defaultPerspectives.map(name => ({ name, enabled: true })));
                        setNewTheme("");
                        setNewPerspective("");
                      }}
                    >
                      Reset
                    </SecondaryButton>
                    <PrimaryButton 
                      type="button" 
                      onClick={downloadXlsx} 
                      disabled={!excel.file || !excel.idColumn || excel.textColumns.length === 0 || downloading}
                      loading={downloading}
                    >
                      {downloading ? (downloadProgress === null ? "Downloading…" : `Downloading ${downloadProgress}%`) : "Download XLSX"}
                    </PrimaryButton>
                  </div>
                </div>
                {loading && generationProgress !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                      <span>Generating mappings...</span>
                      <span>{generationProgress}%</span>
                    </div>
                    <ProgressBar value={generationProgress} />
                  </div>
                )}
                {downloading && downloadProgress !== null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                      <span>Downloading file...</span>
                      <span>{downloadProgress}%</span>
                    </div>
                    <ProgressBar value={downloadProgress} />
                  </div>
                )}
                {error && (
                  <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </GlassCard>

              <GlassCard innerHairline className="p-6">
                <h3 className="text-lg font-semibold text-zinc-200 mb-2">Reference Lists Status</h3>
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-zinc-300 font-medium">Themes:</p>
                    <p className="text-zinc-400">
                      {themes.filter(t => t.enabled).length} of {themes.length} selected
                    </p>
                  </div>
                  <div>
                    <p className="text-zinc-300 font-medium">Perspectives:</p>
                    <p className="text-zinc-400">
                      {perspectives.filter(p => p.enabled).length} of {perspectives.length} selected
                    </p>
                  </div>
                </div>
                <p className="text-sm text-zinc-500 mt-3">
                  Customize the themes and perspectives above to refine your mapping results.
                </p>
              </GlassCard>
            </div>
          )}
        </form>
      </GlassCard>

      {result && result.rows?.length > 0 && (
        <GlassCard>
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-zinc-100">Results</h2>
              <StatusPill variant="success">{result.rows.length} rows</StatusPill>
            </div>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/40 sticky top-0">
                <tr>
                  {result.columns.map((c) => (
                    <th key={c} className="p-4 text-left font-medium text-zinc-300 border-b border-white/10">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors border-b border-white/5 last:border-b-0">
                    {result.columns.map((c) => (
                      <td key={c} className="p-4 align-top text-zinc-200">{r[c] ?? ""}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </PageShell>
  );
}
