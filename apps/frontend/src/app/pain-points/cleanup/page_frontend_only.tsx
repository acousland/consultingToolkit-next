"use client";
import React, { useState, useMemo } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";
import * as XLSX from 'xlsx';

interface ProposalRow {
  id: string; 
  original: string; 
  group_id: string; 
  proposed: string; 
  action: string; 
  rationale: string; 
  merged_ids: string[];
}

interface ProposalResponse { 
  proposal: ProposalRow[]; 
  summary: Record<string, any>; 
}

interface ApplyResponse { 
  clean_pain_points: { id: string; text: string }[]; 
  count: number; 
}

// Simple client-side processing functions
function cleanupPainPoint(text: string, rules: any): string {
  let cleaned = text.trim();
  
  // Present tense conversion (basic)
  if (rules.present_tense) {
    cleaned = cleaned
      .replace(/\b(was|were)\b/gi, 'is')
      .replace(/\b(had|have had)\b/gi, 'has')
      .replace(/\b(did not|didn't)\b/gi, 'does not')
      .replace(/\b(could not|couldn't)\b/gi, 'cannot')
      .replace(/\b(would not|wouldn't)\b/gi, 'will not');
  }
  
  // Remove metrics
  if (rules.remove_metrics) {
    cleaned = cleaned.replace(/\b\d+(\.\d+)?\s*(seconds?|minutes?|hours?|days?|%|percent)\b/gi, '[time/metric]');
  }
  
  // Remove proper nouns (basic implementation)
  if (rules.remove_proper_nouns) {
    cleaned = cleaned.replace(/\b[A-Z][a-zA-Z]*\b/g, (match) => {
      // Keep common words that happen to be capitalized
      const keepWords = ['System', 'User', 'Users', 'Database', 'Server', 'Application', 'API'];
      if (keepWords.includes(match)) return match;
      return '[system]';
    });
  }
  
  // Max length
  if (rules.max_length && cleaned.length > 120) {
    cleaned = cleaned.substring(0, 117) + '...';
  }
  
  return cleaned;
}

function calculateSimilarity(text1: string, text2: string): number {
  // Simple Jaccard similarity based on words
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

function groupSimilarPoints(points: string[], threshold: number): Array<{group: string[], representative: string}> {
  const groups: Array<{group: string[], representative: string}> = [];
  const processed = new Set<number>();
  
  for (let i = 0; i < points.length; i++) {
    if (processed.has(i)) continue;
    
    const group = [points[i]];
    processed.add(i);
    
    for (let j = i + 1; j < points.length; j++) {
      if (processed.has(j)) continue;
      
      if (calculateSimilarity(points[i], points[j]) >= threshold) {
        group.push(points[j]);
        processed.add(j);
      }
    }
    
    groups.push({
      group: group,
      representative: group[0] // Use first item as representative
    });
  }
  
  return groups;
}

export default function CleanupPage() {
  // Excel file upload state
  const [excelData, setExcelData] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  
  // Raw text input state
  const [rawText, setRawText] = useState("");
  
  // Input method selection
  const [inputMethod, setInputMethod] = useState<"excel" | "text">("text");
  
  const [styleRules, setStyleRules] = useState({ 
    present_tense: true, 
    remove_metrics: true, 
    remove_proper_nouns: false, 
    max_length: true 
  });
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

  async function processExcelFile(file: File, textColumns: string[], sheetName?: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          
          const worksheet = sheetName ? 
            workbook.Sheets[sheetName] : 
            workbook.Sheets[workbook.SheetNames[0]];
          
          if (!worksheet) {
            reject(new Error('Worksheet not found'));
            return;
          }
          
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];
          
          const columnIndices = textColumns.map(col => headers.indexOf(col)).filter(idx => idx !== -1);
          
          if (columnIndices.length === 0) {
            reject(new Error('No matching columns found'));
            return;
          }
          
          const extractedText: string[] = [];
          rows.forEach(row => {
            columnIndices.forEach(colIdx => {
              if (row[colIdx] && typeof row[colIdx] === 'string' && row[colIdx].trim()) {
                extractedText.push(row[colIdx].trim());
              }
            });
          });
          
          resolve(extractedText);
        } catch (error) {
          reject(error);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  }

  async function generateProposal() {
    if (!canProcess) return;
    
    setLoading(true); 
    setError(""); 
    setProposal([]); 
    setFinalList([]);
    
    try {
      let points: string[] = [];
      
      if (inputMethod === "excel" && hasExcelData) {
        points = await processExcelFile(excelData.file!, excelData.textColumns, excelData.sheet || undefined);
      } else {
        points = rawPoints;
      }
      
      if (points.length === 0) {
        throw new Error("No pain points to process");
      }
      
      // Process the cleanup client-side
      const cleanedPoints = points.map(point => cleanupPainPoint(point, styleRules));
      const groups = groupSimilarPoints(cleanedPoints, thresholds.merge);
      
      const proposalData: ProposalRow[] = [];
      let idCounter = 0;
      
      groups.forEach((group, groupIndex) => {
        if (group.group.length === 1) {
          // Single item
          proposalData.push({
            id: (idCounter++).toString(),
            original: points[points.findIndex(p => cleanupPainPoint(p, styleRules) === group.group[0])],
            group_id: groupIndex.toString(),
            proposed: group.representative,
            action: "keep",
            rationale: "Unique pain point after cleanup",
            merged_ids: []
          });
        } else {
          // Merged group
          const originalIndices = group.group.map(cleaned => 
            points.findIndex(p => cleanupPainPoint(p, styleRules) === cleaned)
          ).filter(idx => idx !== -1);
          
          proposalData.push({
            id: (idCounter++).toString(),
            original: points[originalIndices[0]],
            group_id: groupIndex.toString(),
            proposed: group.representative,
            action: "merge",
            rationale: `Merged ${group.group.length} similar items`,
            merged_ids: originalIndices.slice(1).map(idx => idx.toString())
          });
        }
      });
      
      const summaryData = {
        total_raw: points.length,
        total_proposed: proposalData.length,
        actions: {
          keep: proposalData.filter(p => p.action === "keep").length,
          merge: proposalData.filter(p => p.action === "merge").length,
          remove: proposalData.filter(p => p.action === "remove").length
        }
      };
      
      setProposal(proposalData); 
      setSummary(summaryData);
    } catch(e: any) { 
      setError(e.message || "Failed to process"); 
    } finally { 
      setLoading(false); 
    }
  }

  function updateAction(id: string, action: string, proposed?: string) {
    setProposal(prev => prev.map(r => r.id === id ? { ...r, action, proposed: proposed !== undefined ? proposed : r.proposed } : r));
  }

  function bulkAccept() {
    setProposal(prev => prev.map(r => ({ ...r, action: "keep" })));
  }

  function applyChanges() {
    const cleanPoints = proposal
      .filter(p => p.action === "keep" || p.action === "merge")
      .map((p, index) => ({
        id: index.toString(),
        text: p.proposed
      }));
    
    setFinalList(cleanPoints);
  }

  function downloadReport() {
    // Create a simple CSV export
    const csvContent = "data:text/csv;charset=utf-8," + 
      "ID,Original,Proposed,Action,Rationale\n" +
      proposal.map(p => 
        `"${p.id}","${p.original.replace(/"/g, '""')}","${p.proposed.replace(/"/g, '""')}","${p.action}","${p.rationale.replace(/"/g, '""')}"`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pain_point_cleanup_report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportFinalList() {
    if (finalList.length === 0) return;
    
    const csvContent = "data:text/csv;charset=utf-8," + 
      "ID,Clean Pain Point\n" +
      finalList.map(item => 
        `"${item.id}","${item.text.replace(/"/g, '""')}"`
      ).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "clean_pain_points.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-900 text-slate-100 -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 min-h-screen">
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
            Client-Side Processing
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
                    <p className="text-emerald-200/80">File: {excelData.file?.name}</p>
                    <p className="text-emerald-200/80">Columns: {excelData.textColumns.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Configuration */}
        <section className="space-y-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">2.</span> Processing Options
          </h2>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Style Rules */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-emerald-300">Style Rules</h3>
              <div className="space-y-3">
                {[
                  { key: 'present_tense', label: 'Convert to Present Tense', desc: 'Transform past tense to present' },
                  { key: 'remove_metrics', label: 'Remove Specific Metrics', desc: 'Replace numbers with placeholders' },
                  { key: 'remove_proper_nouns', label: 'Remove Proper Nouns', desc: 'Replace system names with generic terms' },
                  { key: 'max_length', label: 'Enforce Max Length', desc: 'Truncate long statements' }
                ].map(rule => (
                  <label key={rule.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={styleRules[rule.key as keyof typeof styleRules]}
                      onChange={e => setStyleRules(prev => ({ ...prev, [rule.key]: e.target.checked }))}
                      className="mt-1 rounded border-white/20 bg-white/10 text-fuchsia-500 focus:ring-fuchsia-500/50"
                    />
                    <div>
                      <div className="text-sm font-medium text-slate-200">{rule.label}</div>
                      <div className="text-xs text-slate-400">{rule.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Thresholds */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-emerald-300">Merge Threshold</h3>
              <div className="space-y-3">
                <label className="block">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-200">Similarity Threshold</span>
                    <span className="text-slate-400">{Math.round(thresholds.merge * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={thresholds.merge}
                    onChange={e => setThresholds(prev => ({ ...prev, merge: parseFloat(e.target.value) }))}
                    className="w-full mt-2 accent-fuchsia-500"
                  />
                  <div className="text-xs text-slate-400 mt-1">Higher values require more similarity to merge items</div>
                </label>
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
            <label className="block space-y-3">
              <h3 className="text-lg font-semibold text-emerald-300">Additional Context (Optional)</h3>
              <textarea
                className="w-full h-20 resize-none rounded-xl bg-slate-800/60 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40"
                value={context}
                onChange={e => setContext(e.target.value)}
                placeholder="Describe the domain or provide additional context for better processing..."
              />
            </label>
          </div>
        </section>

        {/* Process Button */}
        <div className="flex justify-center">
          <button
            onClick={generateProposal}
            disabled={!canProcess || loading}
            className="group relative px-8 py-4 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-emerald-600 text-white font-semibold shadow-lg shadow-fuchsia-800/30 hover:from-fuchsia-500 hover:to-emerald-500 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <span className="relative z-10 flex items-center gap-2">
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  🚀 Generate Proposal
                </>
              )}
            </span>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-400">❌</span>
              <div className="text-red-300">{error}</div>
            </div>
          </div>
        )}

        {/* Results */}
        {proposal.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">3.</span> Review & Apply
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={bulkAccept}
                  className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-600/30 text-emerald-300 hover:bg-emerald-600/30 transition-colors"
                >
                  Accept All
                </button>
                <button
                  onClick={downloadReport}
                  className="px-4 py-2 rounded-xl bg-blue-600/20 border border-blue-600/30 text-blue-300 hover:bg-blue-600/30 transition-colors"
                >
                  Download Report
                </button>
              </div>
            </div>

            {/* Summary */}
            <div className="grid gap-4 sm:grid-cols-3">
              {Object.entries(summary.actions || {}).map(([action, count]) => (
                <div key={action} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-2xl font-bold text-white">{count as number}</div>
                  <div className="text-sm text-slate-400 capitalize">{action} Actions</div>
                </div>
              ))}
            </div>

            {/* Proposal Table */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800/90 backdrop-blur">
                    <tr className="border-b border-white/10">
                      <th className="text-left p-4 font-medium text-slate-200">Original</th>
                      <th className="text-left p-4 font-medium text-slate-200">Proposed</th>
                      <th className="text-left p-4 font-medium text-slate-200">Action</th>
                      <th className="text-left p-4 font-medium text-slate-200">Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposal.map((row, idx) => (
                      <tr key={row.id} className={`border-b border-white/5 ${idx % 2 === 0 ? 'bg-white/[0.01]' : ''}`}>
                        <td className="p-4 text-slate-300 max-w-xs truncate">{row.original}</td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={row.proposed}
                            onChange={e => updateAction(row.id, row.action, e.target.value)}
                            className="w-full bg-slate-800/60 border border-white/10 rounded px-2 py-1 text-slate-100 text-xs"
                          />
                        </td>
                        <td className="p-4">
                          <select
                            value={row.action}
                            onChange={e => updateAction(row.id, e.target.value)}
                            className="bg-slate-800/60 border border-white/10 rounded px-2 py-1 text-slate-100 text-xs"
                          >
                            <option value="keep">Keep</option>
                            <option value="merge">Merge</option>
                            <option value="remove">Remove</option>
                          </select>
                        </td>
                        <td className="p-4 text-slate-400 text-xs max-w-xs truncate">{row.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Apply Button */}
            <div className="flex justify-center">
              <button
                onClick={applyChanges}
                className="px-8 py-4 rounded-2xl bg-gradient-to-br from-emerald-600 to-cyan-600 text-white font-semibold shadow-lg hover:from-emerald-500 hover:to-cyan-500 transition-all"
              >
                Apply Changes
              </button>
            </div>
          </section>
        )}

        {/* Final Results */}
        {finalList.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold tracking-tight">
                <span className="bg-gradient-to-r from-fuchsia-400 to-emerald-300 bg-clip-text text-transparent">4.</span> Clean Pain Points
              </h2>
              <button
                onClick={exportFinalList}
                className="px-4 py-2 rounded-xl bg-fuchsia-600/20 border border-fuchsia-600/30 text-fuchsia-300 hover:bg-fuchsia-600/30 transition-colors"
              >
                Export Final List
              </button>
            </div>

            <div className="rounded-3xl border border-emerald-400/30 bg-emerald-500/10 backdrop-blur-xl p-6">
              <div className="text-emerald-300 font-semibold mb-4">✅ Processing Complete ({finalList.length} items)</div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {finalList.map((item, idx) => (
                  <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-400/20">
                    <span className="text-emerald-400 text-sm font-mono">{idx + 1}</span>
                    <span className="text-emerald-100 text-sm">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
