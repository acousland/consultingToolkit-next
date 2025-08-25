"use client";

import React, { useState } from "react";
import { API_BASE } from "@/lib/api";

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
}

export default function PowerPointReviewer() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<ReviewResponse | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
          selectedFile.type === "application/vnd.ms-powerpoint" ||
          selectedFile.name.toLowerCase().endsWith('.pptx') ||
          selectedFile.name.toLowerCase().endsWith('.ppt')) {
        setFile(selectedFile);
        setError("");
      } else {
        setError("Please select a valid PowerPoint file (.pptx or .ppt)");
        setFile(null);
      }
    }
  };

  const handleReview = async () => {
    if (!file) {
      setError("Please select a PowerPoint file first");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("presentation", file);

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
            📊 PowerPoint Reviewer
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed">
            Upload your PowerPoint presentation for AI-powered visual consistency analysis. Get detailed feedback on design, layout, typography, and visual hierarchy for every slide.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur rounded-2xl border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">1.</span> Upload Presentation
          </h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Choose PowerPoint File (.pptx, .ppt)
              </label>
              <div className="relative">
                <input
                  type="file"
                  accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint"
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
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleReview}
              disabled={!file || loading}
              className="w-full py-3 px-6 bg-gradient-to-r from-violet-600 to-pink-600 text-white font-semibold rounded-xl hover:from-violet-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  Analyzing Presentation...
                </>
              ) : (
                <>
                  🔍 Review Presentation
                </>
              )}
            </button>
          </div>
        </div>

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
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Slides</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-violet-600 dark:text-violet-400">
                    {results.presentation_name}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Presentation</div>
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
                    <div className="flex items-start gap-6">
                      {/* Slide Preview */}
                      <div className="flex-shrink-0">
                        <div className="w-32 h-24 bg-gray-200 dark:bg-gray-600 rounded-lg border-2 border-gray-300 dark:border-gray-500 flex items-center justify-center">
                          <img 
                            src={review.image_path} 
                            alt={`Slide ${review.slide_number}`}
                            className="w-full h-full object-contain rounded-lg"
                            onError={(e) => {
                              // Fallback if image fails to load
                              (e.target as HTMLElement).style.display = 'none';
                              (e.target as HTMLElement).parentElement!.innerHTML = `
                                <div class="text-center">
                                  <div class="text-2xl mb-1">📄</div>
                                  <div class="text-xs text-gray-500">Slide ${review.slide_number}</div>
                                </div>
                              `;
                            }}
                          />
                        </div>
                        <div className="text-center mt-2">
                          <div className={`text-lg font-bold ${getScoreColor(review.feedback.overall_score)}`}>
                            {review.feedback.overall_score}%
                          </div>
                          <div className="text-xs text-gray-500">Slide {review.slide_number}</div>
                        </div>
                      </div>

                      {/* Feedback Content */}
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!results && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              📋 <span>How It Works</span>
            </h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">1. Upload</div>
                <p className="text-gray-700 dark:text-gray-300">Select your PowerPoint presentation file (.pptx or .ppt format).</p>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">2. Analysis</div>
                <p className="text-gray-700 dark:text-gray-300">AI converts each slide to an image and analyzes design elements.</p>
              </div>
              <div className="space-y-2">
                <div className="font-medium text-blue-700 dark:text-blue-300">3. Review</div>
                <p className="text-gray-700 dark:text-gray-300">Get detailed feedback on visual consistency, typography, colors, and layout.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
