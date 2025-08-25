"use client";
import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { api, API_BASE } from '@/lib/api';

interface UseCaseRow { id: string; description: string; }
interface Evaluation { id: string; description: string; score: number; reasoning: string; rank: number; }

const Page: React.FC = () => {
  // Company context
  const [dossierFile, setDossierFile] = useState<File | null>(null);
  const [companyText, setCompanyText] = useState('');
  const [contextSummary, setContextSummary] = useState<string>('');
  const [summaryMeta, setSummaryMeta] = useState<any>(null);
  const [summarising, setSummarising] = useState(false);

  // Use cases
  const [useCaseFile, setUseCaseFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [idCol, setIdCol] = useState('');
  const [descCols, setDescCols] = useState<string[]>([]);
  const [useCases, setUseCases] = useState<UseCaseRow[]>([]);

  // Evaluation
  const [evaluating, setEvaluating] = useState(false);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [parallelism, setParallelism] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [evaluationProgress, setEvaluationProgress] = useState({ completed: 0, total: 0 });

  const parseDossier = useCallback(async (f: File) => {
    const ext = f.name.toLowerCase().split('.').pop();
    const text = await f.text();
    if (ext === 'json' || ext === 'xml') {
      setCompanyText(prev => prev ? prev + '\n' + text : text);
    } else {
      setError('Unsupported dossier format (expected JSON or XML)');
    }
  }, []);

  const handleDossierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const f = e.target.files[0];
    setDossierFile(f);
    parseDossier(f).catch(err => setError(String(err)));
  };

  const summariseContext = async () => {
    if (!companyText.trim()) { setError('Company context required'); return; }
    setSummarising(true); setError(null);
    try {
      const res = await api<any>('/ai/use-cases/context/summarise', { method: 'POST', body: JSON.stringify({ context: companyText }) });
      setContextSummary(res.summary);
      setSummaryMeta(res);
    } catch (e:any) {
      setError(e.message);
    } finally { setSummarising(false); }
  };

  const handleUseCaseFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUseCaseFile(f);
    const data = await f.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    setSheetNames(wb.SheetNames);
    const first = wb.SheetNames[0];
    setSelectedSheet(first);
    const ws = wb.Sheets[first];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    const cols = Object.keys(json[0] || {});
    setColumns(cols);
  };

  const buildUseCases = async () => {
    if (!useCaseFile || !selectedSheet || !idCol || descCols.length === 0) return;
    const data = await useCaseFile.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[selectedSheet];
    const json = XLSX.utils.sheet_to_json<any>(ws, { defval: '' });
    const rows: UseCaseRow[] = [];
    for (const row of json) {
      const id = String(row[idCol] || '').trim();
      if (!id) continue;
      const parts = descCols.map(c => String(row[c] || '').trim()).filter(Boolean);
      const desc = parts.join(' | ');
      if (!desc) continue;
      rows.push({ id, description: desc });
    }
    setUseCases(rows);
  };

  const evaluate = async () => {
    if (!contextSummary && !companyText) { setError('Provide or summarise company context first'); return; }
    if (useCases.length === 0) { setError('No use cases prepared'); return; }
    
    setEvaluating(true); 
    setError(null);
    setEvaluationProgress({ completed: 0, total: useCases.length });
    
    try {
      const body = {
        company_context: contextSummary || companyText,
        use_cases: useCases,
        parallelism,
      };
      
      // Start with a simulated progress for immediate feedback
      const progressInterval = setInterval(() => {
        setEvaluationProgress(prev => ({
          completed: Math.min(prev.completed + 1, prev.total - 1),
          total: prev.total
        }));
      }, 1000); // Update every second
      
      const res = await api<any>('/ai/use-cases/evaluate', { method: 'POST', body: JSON.stringify(body) });
      
      clearInterval(progressInterval);
      setEvaluationProgress({ completed: useCases.length, total: useCases.length });
      
      setEvaluations(res.evaluated);
      setStats(res.stats);
    } catch (e:any) {
      setError(e.message);
    } finally { 
      setEvaluating(false);
      // Reset progress after a short delay
      setTimeout(() => {
        setEvaluationProgress({ completed: 0, total: 0 });
      }, 2000);
    }
  };

  const downloadExcel = async () => {
    if (evaluations.length === 0) return;
    const body = {
      company_context: contextSummary || companyText,
      use_cases: useCases,
      parallelism,
    };
    const res = await fetch(`${API_BASE}/ai/use-cases/evaluate.xlsx`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { setError('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai_use_case_evaluations.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 px-4 sm:px-6 lg:px-8 pt-8 bg-gradient-to-br from-violet-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 text-sm font-medium text-violet-700 dark:text-violet-300">
            🤖 AI Evaluation
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600">
            🤖 AI Use Case Customiser
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Evaluate and rank AI use cases for your specific company context. Upload your context and use cases to get AI-powered scoring and recommendations.
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="text-red-500">⚠️</div>
              <div className="text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        )}

        {/* Step 1: Company Context */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">1.</span> Company Context
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Dossier (Optional)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".json,.xml"
                  onChange={handleDossierChange}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-900/20 dark:file:text-violet-300 dark:hover:file:bg-violet-900/30"
                />
              </div>
              {dossierFile && (
                <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 dark:text-green-400">✅</span>
                    <span className="font-medium">{dossierFile.name}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Company Context
              </label>
              <textarea
                className="w-full p-4 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 resize-none"
                rows={8}
                placeholder="Enter or augment company context, business model, industry, key challenges, strategic priorities..."
                value={companyText}
                onChange={e => setCompanyText(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <button 
                className="px-6 py-3 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                disabled={summarising || !companyText.trim()} 
                onClick={summariseContext}
              >
                {summarising ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Summarising...
                  </>
                ) : (
                  '📝 Summarise Context'
                )}
              </button>
              
              {summaryMeta && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                  <span>Length: {summaryMeta.original_length} → {summaryMeta.summary_length}</span>
                  <span className={`px-2 py-1 rounded-full text-xs ${summaryMeta.summarised ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'}`}>
                    {summaryMeta.summarised ? 'Summarised' : 'Raw'}
                  </span>
                </div>
              )}
            </div>

            {contextSummary && (
              <details className="border border-gray-200 dark:border-gray-600 rounded-xl p-4 bg-gray-50 dark:bg-gray-700/50">
                <summary className="cursor-pointer font-medium text-gray-700 dark:text-gray-300 hover:text-violet-600 dark:hover:text-violet-400">
                  📄 View Generated Summary
                </summary>
                <pre className="whitespace-pre-wrap text-sm mt-3 text-gray-600 dark:text-gray-400 leading-relaxed">{contextSummary}</pre>
              </details>
            )}
          </div>
        </div>

        {/* Step 2: Upload Use Cases */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">2.</span> Upload AI Use Cases
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Excel File (.xlsx, .xls, .xlsm)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.xlsm"
                onChange={handleUseCaseFile}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-900/20 dark:file:text-violet-300 dark:hover:file:bg-violet-900/30"
              />
            </div>

            {sheetNames.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sheet</label>
                <select 
                  value={selectedSheet} 
                  onChange={e => setSelectedSheet(e.target.value)} 
                  className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                >
                  {sheetNames.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {columns.length > 0 && (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Use Case ID Column</label>
                  <select 
                    value={idCol} 
                    onChange={e => setIdCol(e.target.value)} 
                    className="w-full p-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
                  >
                    <option value="">Select column...</option>
                    {columns.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description Columns</label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {columns.map(c => {
                      const active = descCols.includes(c);
                      return (
                        <button 
                          key={c} 
                          type="button" 
                          onClick={() => setDescCols(prev => active ? prev.filter(x => x !== c) : [...prev, c])} 
                          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                            active 
                              ? 'bg-violet-600 text-white border-violet-600 shadow-sm' 
                              : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:border-violet-300 dark:hover:border-violet-500'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button 
                onClick={buildUseCases} 
                disabled={!idCol || descCols.length === 0} 
                className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-800 text-white font-semibold rounded-xl hover:from-gray-800 hover:to-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                📋 Prepare Use Cases
              </button>
              
              {useCases.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
                  <span>✅</span>
                  <span>Prepared {useCases.length} use cases</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Step 3: Evaluate */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">3.</span> Evaluate & Rank
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Parallelism: {parallelism}
              </label>
              <input 
                type="range" 
                min={1} 
                max={8} 
                value={parallelism} 
                onChange={e => setParallelism(Number(e.target.value))} 
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>1 (Slow)</span>
                <span>8 (Fast)</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <button 
                onClick={evaluate} 
                disabled={evaluating || useCases.length === 0 || (!contextSummary && !companyText.trim())} 
                className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-xl hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
              >
                {evaluating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Evaluating...
                  </>
                ) : (
                  <>
                    🧪 Run Evaluation
                  </>
                )}
              </button>
              
              <button 
                onClick={downloadExcel} 
                disabled={evaluations.length === 0} 
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                📊 Download Excel
              </button>
            </div>

            {/* Progress Bar */}
            {evaluating && evaluationProgress.total > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Evaluating Use Cases
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {evaluationProgress.completed} / {evaluationProgress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${(evaluationProgress.completed / evaluationProgress.total) * 100}%` }}
                  ></div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Processing {parallelism} use cases in parallel...
                </div>
              </div>
            )}

            {/* Statistics */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard label="Use Cases" value={stats.count} />
                <StatCard label="Avg Score" value={stats.avg?.toFixed(1)} />
                <StatCard label="High (≥80)" value={stats.high_count} />
                <StatCard label="Min Score" value={stats.min} />
                <StatCard label="Max Score" value={stats.max} />
              </div>
            )}

            {/* Results Table */}
            {evaluations.length > 0 && (
              <div className="border border-gray-200 dark:border-gray-600 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        {['Rank', 'ID', 'Score', 'Description', 'Reasoning'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {evaluations.map(ev => (
                        <tr key={ev.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">#{ev.rank}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">{ev.id}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                              ev.score >= 80 
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                                : ev.score >= 60 
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' 
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            }`}>
                              {ev.score}/100
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                            <div className="truncate" title={ev.description}>
                              {ev.description}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                            <div className="whitespace-pre-wrap line-clamp-3">
                              {ev.reasoning}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-700 dark:text-blue-300">
            💡 How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-4 text-sm text-gray-700 dark:text-gray-300">
            <div className="space-y-2">
              <div className="font-medium text-blue-700 dark:text-blue-300">1. Context</div>
              <p>Provide company context through dossier upload or manual input. Large contexts are automatically summarised.</p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-blue-700 dark:text-blue-300">2. Use Cases</div>
              <p>Upload Excel with use cases, select ID and description columns, then prepare for evaluation.</p>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-blue-700 dark:text-blue-300">3. Evaluation</div>
              <p>AI evaluates each use case against company context, providing 1-100 scores with detailed reasoning.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: any }) => (
  <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl border border-gray-200 dark:border-gray-600 p-4 text-center">
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">{label}</div>
    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
  </div>
);

export default Page;
