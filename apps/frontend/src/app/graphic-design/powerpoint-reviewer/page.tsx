"use client";

import React, { useState } from "react";
import { API_BASE } from "@/lib/api";

interface SlidePreview {
  slide_number: number;
  image_path: string;
}

interface SlideReview {
  slide_number: number;
  image_path: string;
  feedback: {
    overall_score: number;
    visual_consistency: string;
    typography: string;
    color_harmony: string;
    layout_balance: string;
    suggestions: string[];
  buzzword_flags?: string[]; // added repetitive corporate buzzword flags
  };
}

interface ReviewResponse {
  presentation_name: string;
  total_slides: number;
  reviews: SlideReview[];
  overall_summary: {
    average_score: number;
    key_strengths: string[];
    priority_improvements: string[];
  };
  mode?: string;
}

export default function PowerPointReviewer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slidePreviews, setSlidePreviews] = useState<SlidePreview[]>([]);
  const [selectedSlides, setSelectedSlides] = useState<number[]>([]);
  const [results, setResults] = useState<ReviewResponse | null>(null);
  const [step, setStep] = useState<'upload' | 'select' | 'results'>('upload');
  const [isPdf, setIsPdf] = useState(true); // now only PDFs allowed
  const [mode, setMode] = useState<'presentation_aid' | 'deliverable'>('presentation_aid');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const lower = selectedFile.name.toLowerCase();
      const isPdfFile = lower.endsWith('.pdf') || selectedFile.type === 'application/pdf';
      if (isPdfFile) {
        setFile(selectedFile);
        setIsPdf(true);
        setError("");
        setSlidePreviews([]);
        setSelectedSlides([]);
        setResults(null);
        setStep('upload');
      } else {
        setError("Only PDF files are supported. Export your presentation to PDF and upload again.");
        setFile(null);
      }
    }
  };

  const handleUploadAndPreview = async () => {
    if (!file) {
      setError("Please select a presentation file first");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("presentation", file);

  const response = await fetch(`${API_BASE}/ai/graphic-design/powerpoint/preview`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Preview failed: ${errorText}`);
      }

      const data = await response.json() as { slides: SlidePreview[] };
      setSlidePreviews(data.slides);
      setSelectedSlides(data.slides.map(slide => slide.slide_number)); // Select all by default
      setStep('select');
    } catch (err: any) {
      setError(err.message || "Failed to preview presentation");
    } finally {
      setLoading(false);
    }
  };

  const handleSlideToggle = (slideNumber: number) => {
    setSelectedSlides(prev => 
      prev.includes(slideNumber) 
        ? prev.filter(n => n !== slideNumber)
        : [...prev, slideNumber].sort((a, b) => a - b)
    );
  };

  const handleSelectAll = () => {
    setSelectedSlides(slidePreviews.map(slide => slide.slide_number));
  };

  const handleDeselectAll = () => {
    setSelectedSlides([]);
  };

  const handleReview = async () => {
    if (!file || selectedSlides.length === 0) {
      setError("Please select at least one slide to review");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("presentation", file);
      formData.append("selected_slides", JSON.stringify(selectedSlides));
  formData.append("mode", mode);

  const response = await fetch(`${API_BASE}/ai/graphic-design/powerpoint/review`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Review failed: ${errorText}`);
      }

      const data = await response.json() as ReviewResponse;
      setResults(data);
      setStep('results');
    } catch (err: any) {
      setError(err.message || "Failed to review presentation");
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600 dark:text-green-400";
    if (score >= 60) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return "bg-green-100 dark:bg-green-900/20";
    if (score >= 60) return "bg-yellow-100 dark:bg-yellow-900/20";
    return "bg-red-100 dark:bg-red-900/20";
  };

  return (
    <div className="min-h-screen -mx-4 sm:-mx-6 lg:-mx-8 -mt-8 px-4 sm:px-6 lg:px-8 pt-8 bg-gradient-to-br from-violet-50 via-white to-pink-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-800 bg-violet-100 dark:bg-violet-900/20 px-4 py-1 backdrop-blur-sm text-xs uppercase tracking-wider text-violet-700 dark:text-violet-300">
            <span className="h-2 w-2 rounded-full bg-violet-500 animate-pulse" />
            AI Design Analysis
          </div>
          <h1 className="text-4xl md:text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-violet-600 via-pink-600 to-purple-600">
            📊 Presentation Reviewer
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Upload a PDF presentation for AI-powered visual and layout analysis. Get detailed feedback on consistency, typography, color, and hierarchy for every page.
          </p>
        </div>

        {/* Upload Section */}
        {step === 'upload' && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">1.</span> Upload Presentation
            </h2>
            
            <div className="space-y-6">
                  {/* Mode Selector */}
                  <div className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Review Mode</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Tailor critique for live presentation vs. leave-behind document.</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setMode('presentation_aid')}
                          className={`px-4 py-2 text-xs font-medium rounded-lg border transition-all ${mode==='presentation_aid' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-gray-700'}`}
                        >
                          Presentation Aid
                        </button>
                        <button
                          type="button"
                          onClick={() => setMode('deliverable')}
                          className={`px-4 py-2 text-xs font-medium rounded-lg border transition-all ${mode==='deliverable' ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-violet-50 dark:hover:bg-gray-700'}`}
                        >
                          Deliverable
                        </button>
                      </div>
                    </div>
                    <div className="text-xs leading-snug text-gray-600 dark:text-gray-400">
                      {mode === 'presentation_aid' ? (
                        <>
                          <strong className="font-semibold">Presentation Aid:</strong> Prioritises instant legibility, minimal cognitive load, and strong visual hierarchy. Penalises dense text, tiny fonts, and weak focal points.
                        </>
                      ) : (
                        <>
                          <strong className="font-semibold">Deliverable:</strong> Emphasises completeness, narrative clarity, self-contained explanation, precise labeling, and professional polish suitable for standalone reading.
                        </>
                      )}
                    </div>
                  </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Choose PDF Presentation File (.pdf)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 dark:file:bg-violet-900/20 dark:file:text-violet-300 dark:hover:file:bg-violet-900/30"
                  />
                </div>
                {file && (
                  <div className="mt-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400">✅</span>
                      <span className="font-medium">{file.name}</span>
                      <span className="text-gray-500">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                      <span className="ml-auto px-2 py-0.5 text-xs rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700">PDF</span>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleUploadAndPreview}
                disabled={!file || loading}
                className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Processing Slides...
                  </>
                ) : (
                  <>
                    📄 Upload & Preview Pages
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Slide Selection Section */}
        {step === 'select' && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">2.</span> Select Slides to Review
            </h2>
            
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-gray-600 dark:text-gray-300">
                  Choose which pages you want to analyze ({selectedSlides.length} of {slidePreviews.length} selected)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelectAll}
                    className="px-4 py-2 text-sm bg-violet-100 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-lg hover:bg-violet-200 dark:hover:bg-violet-900/30"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {slidePreviews.map((slide) => (
                  <div
                    key={slide.slide_number}
                    className={`relative border-2 rounded-lg p-3 cursor-pointer transition-all ${
                      selectedSlides.includes(slide.slide_number)
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-violet-300 dark:hover:border-violet-700'
                    }`}
                    onClick={() => handleSlideToggle(slide.slide_number)}
                  >
                    <div className="aspect-[4/3] bg-gray-100 dark:bg-gray-700 rounded mb-2 overflow-hidden">
                      <img 
                        src={slide.image_path} 
                        alt={`Slide ${slide.slide_number}`}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-sm font-medium">Page {slide.slide_number}</div>
                    </div>
                    {selectedSlides.includes(slide.slide_number) && (
                      <div className="absolute -top-2 -right-2 w-6 h-6 bg-violet-500 text-white rounded-full flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setStep('upload')}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  ← Back to Upload
                </button>
                <button
                  onClick={handleReview}
                  disabled={selectedSlides.length === 0 || loading}
                  className="flex-1 py-3 px-6 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Analyzing Slides...
                    </>
                  ) : (
                    <>
                      🔍 Review Selected Pages ({selectedSlides.length})
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
              <span>❌</span>
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className="space-y-8">
            {/* Overall Summary */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">2.</span> Overall Analysis
              </h2>
              
              <div className="grid md:grid-cols-3 gap-6 mb-6">
                <div className="text-center">
                  <div className={`text-3xl font-bold ${getScoreColor(results.overall_summary.average_score)}`}>
                    {results.overall_summary.average_score.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-700 dark:text-gray-300">
                    {results.total_slides}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Pages</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {results.presentation_name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Presentation</div>
                  {results.mode && (
                    <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] tracking-wide uppercase font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700">
                      {results.mode === 'deliverable' ? 'Deliverable' : 'Presentation Aid'}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="font-semibold text-green-600 dark:text-green-400 flex items-center gap-2">
                    <span>✅</span> Key Strengths
                  </h3>
                  <ul className="space-y-1">
                    {results.overall_summary.key_strengths.map((strength, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-green-500 mt-0.5">•</span>
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                    <span>🎯</span> Priority Improvements
                  </h3>
                  <ul className="space-y-1">
                    {results.overall_summary.priority_improvements.map((improvement, index) => (
                      <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                        <span className="text-orange-500 mt-0.5">•</span>
                        {improvement}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Slide-by-Slide Reviews */}
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
              <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
                <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">3.</span> Slide-by-Slide Feedback
              </h2>
              
                <div className="grid gap-6">
                {results.reviews.map((review, index) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-xl p-6 bg-gradient-to-r from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-700/50">
                    <div className="flex flex-col lg:flex-row items-start gap-8">
                      {/* Slide Preview */}
                      <div className="flex-shrink-0 w-full lg:w-auto">
                        <div className="w-full lg:w-80 h-60 bg-gray-200 dark:bg-gray-600 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex items-center justify-center">
                          <img 
                            src={review.image_path} 
                            alt={`Slide ${review.slide_number}`}
                            className="w-full h-full object-contain rounded-lg cursor-pointer hover:scale-105 transition-transform duration-200"
                            onClick={() => {
                              // Open image in a modal/new tab for even larger view
                              const newWindow = window.open('', '_blank');
                              if (newWindow) {
                                newWindow.document.write(`
                                  <html>
                                    <head><title>Slide ${review.slide_number}</title></head>
                                    <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; min-height:100vh;">
                                      <img src="${review.image_path}" style="max-width:100%; max-height:100%; object-fit:contain;" alt="Slide ${review.slide_number}" />
                                    </body>
                                  </html>
                                `);
                              }
                            }}
                            onError={(e) => {
                              // Fallback if image fails to load
                              (e.target as HTMLElement).style.display = 'none';
                              (e.target as HTMLElement).parentElement!.innerHTML = `
                                <div class="text-center">
                                  <div class="text-4xl mb-2">📄</div>
                                  <div class="text-sm text-gray-500">Slide ${review.slide_number}</div>
                                  <div class="text-xs text-gray-400 mt-1">Click to view full size</div>
                                </div>
                              `;
                            }}
                          />
                        </div>
                        <div className="text-center mt-3">
                          <div className={`text-2xl font-bold ${getScoreColor(review.feedback.overall_score)}`}>
                            {review.feedback.overall_score}%
                          </div>
                          <div className="text-sm text-gray-500 font-medium">Page {review.slide_number}</div>
                          <div className="text-xs text-gray-400 mt-1">Click image to enlarge</div>
                        </div>
                      </div>                      {/* Feedback Content */}
                      <div className="flex-1 space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-purple-600 dark:text-purple-400">Visual Consistency</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{review.feedback.visual_consistency}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400">Typography</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{review.feedback.typography}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-green-600 dark:text-green-400">Color Harmony</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{review.feedback.color_harmony}</p>
                          </div>
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-orange-600 dark:text-orange-400">Layout Balance</h4>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{review.feedback.layout_balance}</p>
                          </div>
                        </div>

                        {/* Suggestions */}
                        <div className="space-y-2">
                          <h4 className="font-semibold text-sm text-violet-600 dark:text-violet-400">💡 Suggestions for Improvement</h4>
                          <ul className="space-y-1">
                            {review.feedback.suggestions.map((suggestion, suggestionIndex) => (
                              <li key={suggestionIndex} className="text-sm text-gray-700 dark:text-gray-300 flex items-start gap-2">
                                <span className="text-violet-500 mt-0.5">•</span>
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {review.feedback.buzzword_flags && review.feedback.buzzword_flags.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-semibold text-sm text-rose-600 dark:text-rose-400 flex items-center gap-2">
                              🚩 Repetitive Corporate Buzzwords
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {review.feedback.buzzword_flags.map((flag, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700"
                                  title="Appears multiple times on this page"
                                >
                                  {flag}
                                </span>
                              ))}
                            </div>
                            <p className="text-xs text-rose-500 dark:text-rose-300 leading-snug">
                              These overused buzzwords dilute clarity and impact. Replace with precise, concrete language.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {step === 'upload' && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📋 <span>How It Works</span>
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">1. Upload</div>
                <p className="text-gray-700 dark:text-gray-300">Export your presentation to PDF and upload the .pdf file.</p>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">2. Select Slides</div>
                <p className="text-gray-700 dark:text-gray-300">Choose which pages you want to analyze for design feedback.</p>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">3. Review</div>
                <p className="text-gray-700 dark:text-gray-300">Get detailed AI feedback on visual consistency, typography, colors, and layout.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
