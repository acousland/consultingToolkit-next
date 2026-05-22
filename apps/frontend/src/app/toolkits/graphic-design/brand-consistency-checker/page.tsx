"use client";

import React, { useState } from 'react';
import { API_BASE } from '@/lib/api';

interface StyleGuideRule { id: string; name: string; description: string; keywords: string[]; }
interface StyleGuideIngest { style_guide_id: string; rules: StyleGuideRule[]; summary: string; characters: number; }
interface DeckSlide { slide_number: number; image_path: string; }
interface DeckIngest { deck_id: string; slides: DeckSlide[]; total_slides: number; }
interface BrandSlideResult { slide_number: number; score: number; issues: string[]; adherence: string[]; recommendations: string[]; image_path: string; }
interface BrandAnalysisSummary { average_score: number; slides_evaluated: number; style_guide_rules: number; style_guide_id: string; deck_id: string; }
interface BrandAnalysisResponse { results: BrandSlideResult[]; summary: BrandAnalysisSummary; rules: StyleGuideRule[]; }

export default function BrandConsistencyChecker() {
  const [styleGuideFile, setStyleGuideFile] = useState<File|null>(null);
  const [deckFile, setDeckFile] = useState<File|null>(null);
  const [styleGuide, setStyleGuide] = useState<StyleGuideIngest|null>(null);
  const [deck, setDeck] = useState<DeckIngest|null>(null);
  const [selectedSlides, setSelectedSlides] = useState<number[]>([]);
  const [analysis, setAnalysis] = useState<BrandAnalysisResponse|null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'upload'|'slides'|'results'>('upload');
  const [progress, setProgress] = useState(0);

  const handleStyleGuideSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setStyleGuideFile(f);
  };
  const handleDeckSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setDeckFile(f);
  };

  const ingestStyleGuide = async () => {
    if (!styleGuideFile) return;
    setLoading(true); setError(''); setProgress(10);
    try {
      const fd = new FormData();
      fd.append('file', styleGuideFile);
      const res = await fetch(`${API_BASE}/ai/brand/style-guide`, { method:'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data: StyleGuideIngest = await res.json();
      setStyleGuide(data);
      setProgress(p => Math.max(p, 40));
    } catch (e:any) {
      setError(e.message || 'Style guide ingestion failed');
    } finally { setLoading(false); }
  };

  const ingestDeck = async () => {
    if (!deckFile) return;
    setLoading(true); setError(''); setProgress(50);
    try {
      const fd = new FormData();
      fd.append('file', deckFile);
      const res = await fetch(`${API_BASE}/ai/brand/deck`, { method:'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const data: DeckIngest = await res.json();
      setDeck(data);
      setSelectedSlides(data.slides.map(s => s.slide_number));
      setProgress(p => Math.max(p, 70));
      setStep('slides');
    } catch (e:any) { setError(e.message || 'Deck ingestion failed'); }
    finally { setLoading(false); }
  };

  const toggleSlide = (n: number) => {
    setSelectedSlides(prev => prev.includes(n) ? prev.filter(x=>x!==n) : [...prev, n].sort((a,b)=>a-b));
  };

  const runAnalysis = async () => {
    if (!styleGuide || !deck) { setError('Upload style guide and deck first'); return; }
    if (selectedSlides.length===0) { setError('Select at least one slide'); return; }
    setLoading(true); setError(''); setProgress(80);
    try {
      const payload = { style_guide_id: styleGuide.style_guide_id, deck_id: deck.deck_id, selected_slides: selectedSlides };
      const res = await fetch(`${API_BASE}/ai/brand/analyse`, { method:'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload)});
      if (!res.ok) throw new Error(await res.text());
      // Simulated progressive UI updates
      let fake = 80; const interval = setInterval(()=>{ fake = Math.min(99, fake+1); setProgress(fake); }, 120);
      const data: BrandAnalysisResponse = await res.json();
      clearInterval(interval);
      setAnalysis(data); setProgress(100); setStep('results');
    } catch (e:any) { setError(e.message || 'Analysis failed'); }
    finally { setLoading(false); }
  };

  const avgScoreColor = (score:number) => score>=80 ? 'text-green-600' : score>=60 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 px-4 sm:px-6 lg:px-8 pt-8 bg-gradient-to-br from-emerald-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-100 dark:bg-emerald-900/20 px-4 py-1 text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Brand Intelligence
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600">
            🎨 Brand Consistency Checker
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Upload a brand style guide PDF and a presentation PDF to evaluate per‑slide adherence to core brand rules.
          </p>
          {progress>0 && (
            <div className="w-full max-w-md mx-auto h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all" style={{width:`${progress}%`}} />
            </div>
          )}
        </div>

        {step==='upload' && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-xl font-semibold mb-3">1. Style Guide PDF</h2>
                <input type="file" accept=".pdf,application/pdf" onChange={handleStyleGuideSelect} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-900/20 dark:file:text-emerald-300" />
                {styleGuideFile && !styleGuide && (
                  <button onClick={ingestStyleGuide} disabled={loading} className="mt-3 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">Extract Rules</button>
                )}
                {styleGuide && (
                  <div className="mt-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm space-y-1">
                    <div className="font-semibold">{styleGuide.rules.length} Rules Extracted</div>
                    <div className="text-emerald-700 dark:text-emerald-300">{styleGuide.summary}</div>
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-3">2. Deck PDF</h2>
                <input type="file" accept=".pdf,application/pdf" onChange={handleDeckSelect} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 dark:file:bg-cyan-900/20 dark:file:text-cyan-300" />
                {deckFile && !deck && (
                  <button onClick={ingestDeck} disabled={loading || !styleGuide} className="mt-3 px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">Render Slides</button>
                )}
                {deck && (
                  <div className="mt-3 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 text-sm space-y-1">
                    <div className="font-semibold">{deck.total_slides} Slides Loaded</div>
                    <div className="text-cyan-700 dark:text-cyan-300">Select slides then run analysis.</div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={()=>{ if(!styleGuide||!deck){setError('Upload both PDFs first'); return;} setStep('slides'); }} disabled={!styleGuide||!deck} className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold disabled:opacity-50">Next: Select Slides →</button>
            </div>
          </div>
        )}

        {step==='slides' && deck && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg space-y-6">
            <h2 className="text-2xl font-semibold mb-2">Select Slides ({selectedSlides.length} of {deck.slides.length})</h2>
            <div className="flex gap-3 flex-wrap mb-4">
              <button onClick={()=> setSelectedSlides(deck.slides.map(s=>s.slide_number))} className="px-3 py-1 text-xs rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Select All</button>
              <button onClick={()=> setSelectedSlides([])} className="px-3 py-1 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">Deselect All</button>
              <button onClick={()=> setStep('upload')} className="px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">← Back</button>
              <button onClick={runAnalysis} disabled={loading || selectedSlides.length===0} className="ml-auto px-5 py-2 rounded bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-sm font-semibold disabled:opacity-50">Run Analysis ({selectedSlides.length})</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {deck.slides.map(slide => (
                <div key={slide.slide_number} onClick={()=>toggleSlide(slide.slide_number)} className={`relative border-2 rounded-lg p-3 cursor-pointer transition-all ${selectedSlides.includes(slide.slide_number) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 dark:hover:border-emerald-700'}`}> 
                  <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 rounded mb-2 overflow-hidden">
                    <img src={slide.image_path} alt={`Slide ${slide.slide_number}`} className="w-full h-full object-contain" />
                  </div>
                  <div className="text-center text-sm font-medium">Slide {slide.slide_number}</div>
                  {selectedSlides.includes(slide.slide_number) && <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">✓</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {step==='results' && analysis && (
          <div className="space-y-8">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6">Overall Summary</h2>
              <div className="grid md:grid-cols-4 gap-6 mb-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${avgScoreColor(analysis.summary.average_score)}`}>{analysis.summary.average_score.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Average Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">{analysis.summary.slides_evaluated}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Slides Evaluated</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{analysis.summary.style_guide_rules}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Rules Applied</div>
                </div>
                <div className="text-center">
                  <div className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">Session IDs<br/>SG: {analysis.summary.style_guide_id.slice(0,8)} • DK: {analysis.summary.deck_id.slice(0,8)}</div>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-emerald-600 dark:text-emerald-400">Extracted Rules</h3>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analysis.rules.map(r => (
                    <div key={r.id} className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-900/10">
                      <div className="text-sm font-semibold mb-1">{r.name}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{r.description}</div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {r.keywords.slice(0,4).map(k => <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300">{k}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6">Per‑Slide Results</h2>
              <div className="grid gap-6">
                {analysis.results.map(slide => (
                  <div key={slide.slide_number} className="border border-gray-200 dark:border-gray-600 rounded-xl p-6 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-800/40 dark:to-gray-700/40">
                    <div className="flex flex-col lg:flex-row gap-8">
                      <div className="flex-shrink-0 w-full lg:w-auto">
                        <div className="w-full lg:w-72 h-52 bg-gray-200 dark:bg-gray-600 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex items-center justify-center overflow-hidden">
                          <img src={slide.image_path} alt={`Slide ${slide.slide_number}`} className="w-full h-full object-contain" />
                        </div>
                        <div className="text-center mt-3">
                          <div className={`text-2xl font-bold ${avgScoreColor(slide.score)}`}>{slide.score}%</div>
                          <div className="text-sm text-gray-500 font-medium">Slide {slide.slide_number}</div>
                        </div>
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-emerald-600 dark:text-emerald-400">Adherence</h4>
                            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                              {slide.adherence.map((a,i)=>(<li key={i}>{a}</li>))}
                              {slide.adherence.length===0 && <li className="italic text-gray-400">No positive matches</li>}
                            </ul>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-rose-600 dark:text-rose-400">Issues</h4>
                            <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                              {slide.issues.map((a,i)=>(<li key={i}>{a}</li>))}
                            </ul>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-semibold text-cyan-600 dark:text-cyan-400">Recommendations</h4>
                          <ul className="space-y-1 text-sm text-gray-700 dark:text-gray-300">
                            {slide.recommendations.map((r,i)=>(<li key={i}>• {r}</li>))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span>❌</span><span className="font-medium">Error:</span><span>{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
