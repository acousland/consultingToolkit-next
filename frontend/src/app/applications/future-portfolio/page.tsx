"use client";
import React, { useState, useCallback } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { PainPointMappingInput } from "@/components/PainPointMappingInput";
import { readStreamingJson } from "@/lib/streaming";
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

type SpreadsheetUpload = {
  applications: StructuredExcelSelection;
  capabilities: StructuredExcelSelection;
  painPointMapping: {
    file: File | null;
    sheet: string | null;
    headers: string[];
    painPointIdColumn?: string;
    painPointDescColumns: string[];
    capabilityIdColumn?: string;
  };
  applicationMapping: StructuredExcelSelection;
};

type Recommendation = {
  capability: string;
  painPoints: string[];
  affectedApplications: string[];
  recommendation: string;
  priority: "High" | "Medium" | "Low";
  impact: string;
  effort: string;
};

type HarmonizedRecommendation = {
  application: string;
  actions: string[];
  overallPriority: "High" | "Medium" | "Low";
  totalImpact: string;
  consolidatedRationale: string;
};

type AnalysisResult = {
  recommendations: Recommendation[];
  harmonizedRecommendations: HarmonizedRecommendation[];
  summary: {
    totalCapabilities: number;
    totalApplications: number;
    highPriorityActions: number;
  };
};

export default function FuturePortfolioPage() {
  const [spreadsheets, setSpreadsheets] = useState<SpreadsheetUpload>({
    applications: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
    capabilities: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
    painPointMapping: { file: null, sheet: null, headers: [], painPointIdColumn: undefined, painPointDescColumns: [], capabilityIdColumn: undefined },
    applicationMapping: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');

  const canSubmit = 
    // Applications and capabilities need standard fields
    !!spreadsheets.applications.file && !!spreadsheets.applications.idColumn && spreadsheets.applications.textColumns.length > 0 &&
    !!spreadsheets.capabilities.file && !!spreadsheets.capabilities.idColumn && spreadsheets.capabilities.textColumns.length > 0 &&
    // Pain point mapping needs custom fields
    !!spreadsheets.painPointMapping.file && !!spreadsheets.painPointMapping.painPointIdColumn && 
    spreadsheets.painPointMapping.painPointDescColumns.length > 0 && !!spreadsheets.painPointMapping.capabilityIdColumn &&
    // Application mapping needs standard fields
    !!spreadsheets.applicationMapping.file && !!spreadsheets.applicationMapping.idColumn && spreadsheets.applicationMapping.textColumns.length > 0 &&
    !loading;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setAnalysisProgress(0);
    setCurrentStep('Preparing analysis...');

    try {
      const fd = new FormData();
      
      // Add all spreadsheets
      Object.entries(spreadsheets).forEach(([key, sheet]) => {
        if (!sheet.file) throw new Error(`${key} file not selected`);
        fd.append(`${key}_file`, sheet.file);
        
        if (key === 'painPointMapping') {
          const ppSheet = sheet as SpreadsheetUpload['painPointMapping'];
          fd.append(`${key}_pain_point_id_column`, ppSheet.painPointIdColumn || "");
          fd.append(`${key}_pain_point_desc_columns`, JSON.stringify(ppSheet.painPointDescColumns));
          fd.append(`${key}_capability_id_column`, ppSheet.capabilityIdColumn || "");
        } else {
          const stdSheet = sheet as StructuredExcelSelection;
          fd.append(`${key}_id_column`, stdSheet.idColumn || "");
          fd.append(`${key}_text_columns`, JSON.stringify(stdSheet.textColumns));
        }
        
        if (sheet.sheet) fd.append(`${key}_sheet_name`, sheet.sheet);
      });

      const res = await fetch("/api/ai/applications/future-portfolio", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());

      // Handle streaming response with progress updates
      for await (const chunk of readStreamingJson(res)) {
        if (chunk.type === 'progress') {
          setAnalysisProgress(chunk.progress);
          setCurrentStep(chunk.message);
        } else if (chunk.type === 'result') {
          setResult(chunk.data);
          setAnalysisProgress(100);
          setCurrentStep('Analysis complete!');
        } else if (chunk.type === 'error') {
          throw new Error(chunk.message);
        }
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to generate portfolio analysis";
      setError(message);
    } finally {
      setLoading(false);
      setTimeout(() => {
        setAnalysisProgress(null);
        setCurrentStep('');
      }, 2000);
    }
  }

  function updateSpreadsheet(key: keyof SpreadsheetUpload, value: StructuredExcelSelection) {
    setSpreadsheets(prev => ({ ...prev, [key]: value }));
  }

  const updateApplications = useCallback((value: StructuredExcelSelection) => {
    updateSpreadsheet('applications', value);
  }, []);

  const updateCapabilities = useCallback((value: StructuredExcelSelection) => {
    updateSpreadsheet('capabilities', value);
  }, []);

  const updatePainPointMapping = useCallback((value: SpreadsheetUpload['painPointMapping']) => {
    setSpreadsheets(prev => ({ ...prev, painPointMapping: value }));
  }, []);

  const updateApplicationMapping = useCallback((value: StructuredExcelSelection) => {
    updateSpreadsheet('applicationMapping', value);
  }, []);

  function resetAll() {
    setSpreadsheets({
      applications: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
      capabilities: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
      painPointMapping: { file: null, sheet: null, headers: [], painPointIdColumn: undefined, painPointDescColumns: [], capabilityIdColumn: undefined },
      applicationMapping: { file: null, sheet: null, headers: [], textColumns: [], idColumn: undefined },
    });
    setResult(null);
    setError(null);
    setAnalysisProgress(null);
    setCurrentStep('');
  }

  return (
    <PageShell>
      <HeaderBand label="Applications Analysis" />
      <GradientTitle>Future State Application Portfolio Generator</GradientTitle>
      <p className="text-zinc-400 text-lg leading-relaxed mb-8">
        Upload four key spreadsheets to generate capability-based recommendations for your application portfolio transformation.
      </p>

      <form onSubmit={onSubmit} className="space-y-8">
        {/* Spreadsheet Uploads */}
        <div className="space-y-6">
          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">1. Applications Registry</h3>
            <ExcelDataInput 
              mode="id-text" 
              value={spreadsheets.applications} 
              onChange={updateApplications}
              labels={{ id: "Application ID", text: "Application Details" }}
            />
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">2. Capabilities Framework</h3>
            <ExcelDataInput 
              mode="id-text" 
              value={spreadsheets.capabilities} 
              onChange={updateCapabilities}
              labels={{ id: "Capability ID", text: "Capability Details" }}
            />
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">3. Pain Point → Capability Mapping</h3>
            <PainPointMappingInput 
              value={spreadsheets.painPointMapping} 
              onChange={updatePainPointMapping}
              required
            />
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-zinc-200 mb-4">4. Application → Capability Mapping</h3>
            <ExcelDataInput 
              mode="id-text" 
              value={spreadsheets.applicationMapping} 
              onChange={updateApplicationMapping}
              labels={{ id: "Application ID", text: "Capability Mappings" }}
            />
          </GlassCard>
        </div>

        {/* Analysis Controls */}
        <GlassCard className="p-6">
          <h3 className="text-lg font-semibold text-zinc-200 mb-4">Generate Portfolio Recommendations</h3>
          <div className="flex flex-wrap items-center gap-4">
            <PrimaryButton 
              disabled={!canSubmit} 
              loading={loading}
              type="submit"
            >
              {loading ? "Analyzing Portfolio..." : "Generate Recommendations"}
            </PrimaryButton>
            <SecondaryButton type="button" onClick={resetAll}>
              Reset All
            </SecondaryButton>
          </div>
          
          {loading && analysisProgress !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-zinc-400 mb-2">
                <span>{currentStep}</span>
                <span>{analysisProgress}%</span>
              </div>
              <ProgressBar value={analysisProgress} />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </GlassCard>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-8">
          {/* Summary */}
          <GlassCard>
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-zinc-100">Analysis Summary</h2>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400">{result.summary.totalCapabilities}</div>
                  <div className="text-sm text-zinc-400">Capabilities Analyzed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{result.summary.totalApplications}</div>
                  <div className="text-sm text-zinc-400">Applications Reviewed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-400">{result.summary.highPriorityActions}</div>
                  <div className="text-sm text-zinc-400">High Priority Actions</div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Capability-Based Recommendations */}
          <GlassCard>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-zinc-100">Capability-Based Recommendations</h2>
                <StatusPill variant="info">{result.recommendations.length} recommendations</StatusPill>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {result.recommendations.map((rec, idx) => (
                <div key={idx} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-zinc-200">{rec.capability}</h3>
                    <StatusPill variant={rec.priority === "High" ? "warning" : rec.priority === "Medium" ? "info" : "neutral"}>
                      {rec.priority} Priority
                    </StatusPill>
                  </div>
                  <p className="text-zinc-300 mb-3">{rec.recommendation}</p>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-zinc-400">Affected Applications:</span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {rec.affectedApplications.map((app, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded">{app}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="font-medium text-zinc-400">Related Pain Points:</span>
                      <div className="mt-1 text-zinc-400">{rec.painPoints.join(", ")}</div>
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mt-3 text-sm">
                    <div><span className="font-medium text-zinc-400">Impact:</span> {rec.impact}</div>
                    <div><span className="font-medium text-zinc-400">Effort:</span> {rec.effort}</div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Harmonized Application Actions */}
          <GlassCard>
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-semibold text-zinc-100">Harmonized Application Actions</h2>
                <StatusPill variant="success">{result.harmonizedRecommendations.length} applications</StatusPill>
              </div>
            </div>
            <div className="divide-y divide-white/5">
              {result.harmonizedRecommendations.map((harm, idx) => (
                <div key={idx} className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-zinc-200">{harm.application}</h3>
                    <StatusPill variant={harm.overallPriority === "High" ? "warning" : harm.overallPriority === "Medium" ? "info" : "neutral"}>
                      {harm.overallPriority} Priority
                    </StatusPill>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-zinc-400">Recommended Actions:</span>
                      <ul className="mt-1 ml-4 space-y-1">
                        {harm.actions.map((action, i) => (
                          <li key={i} className="text-zinc-300 list-disc">{action}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div><span className="font-medium text-zinc-400">Total Impact:</span> {harm.totalImpact}</div>
                      <div><span className="font-medium text-zinc-400">Rationale:</span> {harm.consolidatedRationale}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}
    </PageShell>
  );
}
