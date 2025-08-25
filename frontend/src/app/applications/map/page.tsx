"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";

type IndividualAppMapResponse = {
  analysis: string;
  application_summary: {
    name: string;
    id: string;
    description: string;
    total_capabilities: number;
    context_provided: boolean;
  };
  raw_response: string;
};

export default function IndividualAppMap() {
  // Session state for capabilities
  const [capabilitiesData, setCapabilitiesData] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  
  // Application inputs
  const [applicationName, setApplicationName] = useState("");
  const [applicationId, setApplicationId] = useState("");
  const [applicationDescription, setApplicationDescription] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  
  // Processing state
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<IndividualAppMapResponse | null>(null);
  const [error, setError] = useState("");

  const hasCapabilities = capabilitiesData.file && 
                         capabilitiesData.idColumn && 
                         capabilitiesData.textColumns.length > 0;

  const canGenerateMapping = hasCapabilities && 
                            applicationName.trim() && 
                            applicationDescription.trim();

  async function handleMapping() {
    if (!canGenerateMapping) return;
    
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      const formData = new FormData();
      formData.append("capabilities_file", capabilitiesData.file!);
      formData.append("capabilities_sheet", capabilitiesData.sheet || "");
      formData.append("capabilities_id_column", capabilitiesData.idColumn!);
      formData.append("capabilities_text_columns", JSON.stringify(capabilitiesData.textColumns));
      
      formData.append("application_name", applicationName.trim());
      formData.append("application_id", applicationId.trim());
      formData.append("application_description", applicationDescription.trim());
      formData.append("additional_context", additionalContext.trim());

      const res = await fetch("/api/ai/applications/map-file", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data: IndividualAppMapResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function resetAnalysis() {
    setApplicationName("");
    setApplicationId("");
    setApplicationDescription("");
    setAdditionalContext("");
    setResponse(null);
    setError("");
  }

  async function downloadAnalysis() {
    if (!response) return;
    
    const content = `# Individual Application to Capability Mapping Analysis

## Application Summary
- **Name**: ${response.application_summary.name}
- **ID**: ${response.application_summary.id || "Not provided"}
- **Description**: ${response.application_summary.description}
- **Total Capabilities in Framework**: ${response.application_summary.total_capabilities}
- **Additional Context Provided**: ${response.application_summary.context_provided ? "Yes" : "No"}

## AI Analysis
${response.analysis}

---
Generated on ${new Date().toLocaleString()}
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${response.application_summary.name.replace(/[^a-zA-Z0-9]/g, '_')}_capability_mapping.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen p-8 -mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      <div className="mx-auto max-w-6xl space-y-6 pt-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black">🎯 Individual Application to Capability Mapping</h1>
          <p className="text-xl font-medium">Map a single application to organisational capabilities</p>
          <p className="text-gray-600 max-w-4xl">
            This tool helps you quickly map individual applications to your capability framework. Upload your capability 
            model, describe your application, and receive AI-powered capability mappings for architecture analysis.
          </p>
        </div>

        <hr className="border-gray-200" />

        {/* Step 1: Upload Capability Framework */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">📊 Step 1: Upload Capability Framework</h2>
          
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <ExcelDataInput
              value={capabilitiesData}
              onChange={setCapabilitiesData}
              mode="id-text"
              labels={{ id: "Capability ID Column", text: "Capability Description Columns" }}
            />
            
            {hasCapabilities && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="font-medium text-green-800 mb-2">✅ Capabilities Preview:</h3>
                <div className="text-sm text-green-700 space-y-1">
                  <p><strong>File:</strong> {capabilitiesData.file!.name}</p>
                  <p><strong>ID Column:</strong> {capabilitiesData.idColumn}</p>
                  <p><strong>Description Columns:</strong> {capabilitiesData.textColumns.join(", ")}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Application Input */}
        {hasCapabilities && (
          <>
            <hr className="border-gray-200" />
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">🔧 Step 2: Describe Your Application</h2>
              
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Application Name: <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={applicationName}
                      onChange={(e) => setApplicationName(e.target.value)}
                      placeholder="e.g., Customer Relationship Management System"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter the name or identifier for your application</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Application ID (optional):
                    </label>
                    <input
                      type="text"
                      value={applicationId}
                      onChange={(e) => setApplicationId(e.target.value)}
                      placeholder="e.g., CRM-001, APP-345"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional: Enter a unique identifier for this application</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Application Description: <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={applicationDescription}
                    onChange={(e) => setApplicationDescription(e.target.value)}
                    placeholder="Describe what this application does, its main functions, user groups, business purpose, technical characteristics, etc."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-32 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Provide a detailed description to help with accurate capability mapping</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Context (optional):
                  </label>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder="e.g., Focus on customer-facing capabilities, emphasise operational processes, consider regulatory requirements..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20 resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Optional context to guide the mapping process</p>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Step 3: Generate Mapping */}
        {canGenerateMapping && (
          <>
            <hr className="border-gray-200" />
            
            <div className="space-y-4">
              <h2 className="text-2xl font-bold">🚀 Step 3: Generate Capability Mapping</h2>
              
              <div className="bg-white rounded-2xl border border-gray-200 p-6">
                <button
                  onClick={handleMapping}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Analysing application and generating capability mappings...
                    </span>
                  ) : (
                    "🎯 Map Application to Capabilities"
                  )}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-600">❌</span>
              <h3 className="font-medium text-red-800">Error generating capability mapping</h3>
            </div>
            <p className="text-red-700 text-sm mt-1">{error}</p>
            <p className="text-red-600 text-sm mt-1">Please check your inputs and try again.</p>
          </div>
        )}

        {/* Results */}
        {response && (
          <div className="space-y-6">
            <hr className="border-gray-200" />
            
            <h2 className="text-2xl font-bold">🎯 Capability Mapping Results</h2>

            {/* Application Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">📱 Application Summary</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Application Name:</p>
                      <p className="text-lg font-medium">{response.application_summary.name}</p>
                    </div>
                    {response.application_summary.id && (
                      <div>
                        <p className="text-sm font-medium text-gray-600">Application ID:</p>
                        <p className="font-medium">{response.application_summary.id}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-600">Description:</p>
                      <p className="text-gray-800">{response.application_summary.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-blue-50 rounded-lg p-4">
                    <div className="text-3xl font-bold text-blue-600">{response.application_summary.total_capabilities}</div>
                    <div className="text-sm text-blue-800 text-center">Total Capabilities in Framework</div>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Analysis Results */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold">🤖 AI Analysis Results</h3>
                <button
                  onClick={downloadAnalysis}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  📄 Download Analysis
                </button>
              </div>
              <div className="p-6">
                {response.analysis.includes("No Direct Capability Mappings Found") ? (
                  <div className="text-center py-8">
                    <div className="text-4xl mb-4">🔍</div>
                    <h4 className="text-lg font-semibold text-orange-600 mb-2">No Direct Capability Mappings Found</h4>
                    <p className="text-gray-600">The AI analysis did not find any strong alignments between this application and the available capabilities in your framework.</p>
                  </div>
                ) : (
                  <div className="prose prose-gray max-w-none">
                    <div dangerouslySetInnerHTML={{ 
                      __html: response.analysis
                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                        .replace(/\n- /g, '\n<li>')
                        .replace(/\n/g, '<br />')
                        .replace(/<br \/><li>/g, '</li><li>')
                        .replace(/<li>/g, '<ul><li>')
                        .replace(/(<br \/>){2,}/g, '</ul><br /><br /><ul>')
                        .replace(/<ul><\/ul>/g, '')
                        .replace(/(<ul><li>.*?<\/li>)(?!<li>)/g, '$1</ul>')
                    }} />
                  </div>
                )}
              </div>
            </div>

            {/* Additional Analysis Info */}
            {additionalContext.trim() && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">� Analysis Context</h4>
                <p className="text-blue-700 text-sm">Additional context used: {additionalContext}</p>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold">🔄 Quick Actions</h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <button
                    onClick={resetAnalysis}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    🔄 Analyse Another Application
                  </button>
                  <button
                    onClick={() => window.open('/applications/capabilities', '_blank')}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    🔗 Bulk Application Mapping
                  </button>
                  <button
                    onClick={() => window.open('/toolkits/applications', '_blank')}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    🏗️ Back to Applications Toolkit
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-800 font-medium">✅ Capability mapping analysis complete!</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
