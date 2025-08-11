"use client";
import { useState } from "react";
import { ExcelDataInput } from "@/components/ExcelDataInput";
import { StructuredExcelSelection, emptyStructuredExcelSelection } from "@/types/excel";

type AppCapMapResult = {
  application_id: string;
  application_name: string;
  capability_ids: string[];
  raw_response: string;
};

type AppCapMapResponse = {
  results: AppCapMapResult[];
  summary: {
    total_mappings: number;
    applications_processed: number;
    capabilities_matched: number;
    no_mappings: number;
  };
};

export default function ApplicationCapabilityMap() {
  const [applicationsData, setApplicationsData] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [capabilitiesData, setCapabilitiesData] = useState<StructuredExcelSelection>(emptyStructuredExcelSelection());
  const [context, setContext] = useState("");
  const [batchSize, setBatchSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AppCapMapResponse | null>(null);
  const [error, setError] = useState("");

  const canProcess = applicationsData.file && 
                    applicationsData.idColumn && 
                    applicationsData.textColumns.length > 0 &&
                    capabilitiesData.file && 
                    capabilitiesData.idColumn && 
                    capabilitiesData.textColumns.length > 0;

  async function handleMapping() {
    if (!canProcess) return;
    
    setLoading(true);
    setError("");
    setResponse(null);

    try {
      // Build FormData for applications file
      const formData = new FormData();
      formData.append("applications_file", applicationsData.file!);
      formData.append("applications_sheet", applicationsData.sheet || "");
      formData.append("applications_id_column", applicationsData.idColumn!);
      formData.append("applications_text_columns", JSON.stringify(applicationsData.textColumns));
      
      formData.append("capabilities_file", capabilitiesData.file!);
      formData.append("capabilities_sheet", capabilitiesData.sheet || "");
      formData.append("capabilities_id_column", capabilitiesData.idColumn!);
      formData.append("capabilities_text_columns", JSON.stringify(capabilitiesData.textColumns));
      
      formData.append("additional_context", context.trim());
      formData.append("batch_size", String(batchSize));

      const res = await fetch("/api/ai/applications/capabilities/map-files", {
        method: "POST",
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data: AppCapMapResponse = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadExcel() {
    if (!canProcess || !response) return;

    try {
      const formData = new FormData();
      formData.append("applications_file", applicationsData.file!);
      formData.append("applications_sheet", applicationsData.sheet || "");
      formData.append("applications_id_column", applicationsData.idColumn!);
      formData.append("applications_text_columns", JSON.stringify(applicationsData.textColumns));
      
      formData.append("capabilities_file", capabilitiesData.file!);
      formData.append("capabilities_sheet", capabilitiesData.sheet || "");
      formData.append("capabilities_id_column", capabilitiesData.idColumn!);
      formData.append("capabilities_text_columns", JSON.stringify(capabilitiesData.textColumns));
      
      formData.append("additional_context", context.trim());
      formData.append("batch_size", String(batchSize));

      const res = await fetch("/api/ai/applications/capabilities/map-files.xlsx", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'application_capability_mapping.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  return (
    <main className="space-y-6">
      <div className="mx-auto max-w-6xl">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold">Application → Capability Mapping</h1>
          <p className="text-gray-600 max-w-3xl">Map applications to organisational capabilities for technology landscape analysis. Uses AI to analyze application descriptions against capability definitions.</p>
        </div>

        {/* Applications Upload */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="text-blue-600">📱</span>
              Applications Dataset
            </h2>
            <ExcelDataInput
              value={applicationsData}
              onChange={setApplicationsData}
              mode="id-text"
              labels={{ id: "Application ID", text: "Description Columns" }}
            />
            {applicationsData.file && applicationsData.idColumn && applicationsData.textColumns.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                <p>File loaded: <strong>{applicationsData.file.name}</strong></p>
                <p>ID Column: <strong>{applicationsData.idColumn}</strong></p>
                <p>Text Columns: <strong>{applicationsData.textColumns.join(", ")}</strong></p>
              </div>
            )}
          </div>

          {/* Capabilities Upload */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span className="text-green-600">🎯</span>
              Capabilities Dataset
            </h2>
            <ExcelDataInput
              value={capabilitiesData}
              onChange={setCapabilitiesData}
              mode="id-text"
              labels={{ id: "Capability ID", text: "Description Columns" }}
            />
            {capabilitiesData.file && capabilitiesData.idColumn && capabilitiesData.textColumns.length > 0 && (
              <div className="mt-4 text-sm text-gray-600">
                <p>File loaded: <strong>{capabilitiesData.file.name}</strong></p>
                <p>ID Column: <strong>{capabilitiesData.idColumn}</strong></p>
                <p>Text Columns: <strong>{capabilitiesData.textColumns.join(", ")}</strong></p>
              </div>
            )}
          </div>

          {/* Configuration */}
          {canProcess && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                <span className="text-purple-600">⚙️</span>
                Processing Configuration
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Additional Context (Optional)</label>
                  <textarea
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                    placeholder="e.g., Large financial services organisation with focus on digital banking platforms and regulatory compliance systems."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none h-20"
                  />
                  <p className="text-xs text-gray-500 mt-1">Provide industry context, organization type, or technology focus to improve mapping accuracy.</p>
                </div>

                <div className="flex items-center gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Batch Size</label>
                    <select
                      value={batchSize}
                      onChange={(e) => setBatchSize(Number(e.target.value))}
                      className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg"
                    >
                      <option value={5}>5 (slower, more reliable)</option>
                      <option value={10}>10 (recommended)</option>
                      <option value={15}>15</option>
                      <option value={20}>20</option>
                      <option value={25}>25 (faster, less reliable)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleMapping}
                    disabled={loading || !canProcess}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </>
                    ) : (
                      <>🚀 Start Application Mapping</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Results */}
          {response && (
            <div className="space-y-6">
              {/* Summary Statistics */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="font-semibold mb-4 flex items-center gap-2">
                  <span className="text-indigo-600">📊</span>
                  Mapping Results Summary
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{response.summary.total_mappings}</div>
                    <div className="text-sm text-gray-600">Total Mappings</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{response.summary.applications_processed}</div>
                    <div className="text-sm text-gray-600">Applications Processed</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{response.summary.capabilities_matched}</div>
                    <div className="text-sm text-gray-600">Capabilities Matched</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">{response.summary.no_mappings}</div>
                    <div className="text-sm text-gray-600">No Mappings Found</div>
                  </div>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <span className="text-green-600">📋</span>
                    Application to Capability Mappings
                  </h2>
                  <button
                    onClick={downloadExcel}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    📊 Download Excel
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="text-left p-4 font-medium">Application ID</th>
                        <th className="text-left p-4 font-medium">Application Name</th>
                        <th className="text-left p-4 font-medium">Capability IDs</th>
                        <th className="text-left p-4 font-medium">Raw Response</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.results.map((result, index) => (
                        <tr key={result.application_id} className={index % 2 === 0 ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900"}>
                          <td className="p-4 font-mono text-sm">{result.application_id}</td>
                          <td className="p-4">{result.application_name}</td>
                          <td className="p-4">
                            {result.capability_ids.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {result.capability_ids.map((capId, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded text-xs font-mono"
                                  >
                                    {capId}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-gray-500 italic">No mapping found</span>
                            )}
                          </td>
                          <td className="p-4 text-sm text-gray-600 max-w-xs">
                            <div className="truncate" title={result.raw_response}>
                              {result.raw_response || "N/A"}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Export Information */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 p-4 rounded-lg">
                <p className="font-medium mb-2">📁 Excel File Contents:</p>
                <ul className="text-sm space-y-1 ml-4">
                  <li>• <strong>Application Mappings</strong> sheet: Detailed application to capability mappings</li>
                  <li>• <strong>Summary</strong> sheet: Mapping statistics and counts</li>
                  <li>• <strong>Applications Overview</strong> sheet: Number of mappings per application</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
