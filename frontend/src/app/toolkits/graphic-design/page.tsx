"use client";

import Link from "next/link";

export default function GraphicDesignToolkit() {
  return (
    <div className="space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
          🎨 Graphic Design Toolkit
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Professional design analysis and improvement tools for presentations, layouts, and visual content.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* PowerPoint Reviewer */}
        <Link 
          href="/graphic-design/powerpoint-reviewer"
          className="group block p-6 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-900/20 dark:to-pink-900/20 rounded-xl border border-violet-200 dark:border-violet-800 hover:shadow-lg transition-all duration-200"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-violet-500 to-pink-500 rounded-lg text-white">
              📊
            </div>
            <div>
              <h3 className="text-lg font-semibold group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                PowerPoint Reviewer
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI-powered presentation analysis
              </p>
            </div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            Upload your PowerPoint presentation for comprehensive visual consistency analysis. Get slide-by-slide feedback on design, layout, typography, and visual hierarchy to enhance your presentation's professional impact.
          </p>
          <div className="mt-4 flex items-center text-violet-600 dark:text-violet-400 text-sm font-medium">
            Launch Tool
            <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
          </div>
        </Link>

        {/* Future tools placeholder */}
        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gray-400 rounded-lg text-white">
              🎨
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                Brand Consistency Checker
              </h3>
              <p className="text-sm text-gray-500">
                Coming Soon
              </p>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Analyze your visual content for brand guideline compliance, color consistency, and typography standards.
          </p>
        </div>

        <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 opacity-60">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gray-400 rounded-lg text-white">
              📐
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-400">
                Layout Optimizer
              </h3>
              <p className="text-sm text-gray-500">
                Coming Soon
              </p>
            </div>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Optimize layouts for better visual flow, readability, and professional appearance across different formats.
          </p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          💡 <span>Pro Tips</span>
        </h3>
        <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li>• Upload high-resolution presentations for the most accurate analysis</li>
          <li>• Review feedback systematically - start with structural issues before fine-tuning details</li>
          <li>• Consider your audience and presentation context when implementing suggestions</li>
          <li>• Save before and after versions to track your design improvements over time</li>
        </ul>
      </div>
    </div>
  );
}
