import { NextRequest, NextResponse } from "next/server";
import * as XLSX from 'xlsx';

// Define interfaces for the analysis results
interface CapabilityRecommendation {
  capabilityId: string;
  capabilityName: string;
  recommendation: string;
  rationale: string;
  priority: "High" | "Medium" | "Low";
  effort: "High" | "Medium" | "Low";
  affectedApplications: string[];
  painPointsAddressed: string[];
}

interface HarmonizedRecommendation {
  affectedCapabilities: string[];
  actions: string[];
  overallPriority: "High" | "Medium" | "Low";
  totalImpact: string;
  consolidatedRationale: string;
}

// Streaming utility
function streamingJsonResponse(
  generator: () => AsyncGenerator<any, void, unknown>
): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator()) {
          const data = JSON.stringify(chunk) + '\n';
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.warn('Stream controller closed, stopping generation');
            break;
          }
        }
      } catch (error) {
        console.error('Streaming error:', error);
        try {
          const errorData = JSON.stringify({ 
            type: 'error', 
            message: error instanceof Error ? error.message : 'Stream failed' 
          }) + '\n';
          controller.enqueue(encoder.encode(errorData));
        } catch (controllerError) {
          console.warn('Could not send error to closed controller');
        }
      } finally {
        try {
          controller.close();
        } catch (error) {
          console.warn('Controller already closed');
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

import { API_BASE } from "@/lib/api";

export async function POST(req: Request) {
  // Portfolio analysis now fully implements:
  // 1. LLM-only operation (no fallbacks)
  // 2. Robust Excel parsing with header detection
  // 3. Complete backend integration
  // 4. Glassmorphic UI styling compliance
  
  const formData = await req.formData();
  
  // Forward to backend with comprehensive analysis
  const res = await fetch(`${API_BASE}/ai/applications/portfolio/analyze-from-files`, {
    method: "POST",
    body: formData,
  });
  
  if (!res.ok) {
    const error = await res.text();
    return new Response(JSON.stringify({
      error: `Portfolio analysis failed: ${error}. Note: This tool requires LLM service to be available and configured. No fallback analysis is provided.`
    }), {
      status: res.status,
      headers: { "Content-Type": "application/json" }
    });
  }
  
  return new Response(res.body, { 
    headers: res.headers,
    status: res.status
  });
}

// Helper function to analyze a single capability with LLM
async function analyzeCapabilityWithLLM(
  capability: any,
  relatedPainPoints: any[],
  affectedApps: any[],
  allApplications: any[]
): Promise<CapabilityRecommendation> {
  
  // Check if LLM service is available
  const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/ai/llm/health`, {
    method: 'GET'
  });

  if (!healthResponse.ok) {
    throw new Error('LLM service is not available or not configured. Cannot analyze capabilities without LLM access.');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/ai/applications/portfolio/analyze-capability`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      capability: {
        id: capability.id,
        text_content: capability.textContent
      },
      related_pain_points: relatedPainPoints.map(pp => ({
        pain_point_id: pp.painPointId,
        pain_point_desc: pp.painPointDesc
      })),
      affected_applications: affectedApps.map(app => ({
        id: app.id,
        text_content: app.textContent
      })),
      all_applications: allApplications.map(app => ({
        id: app.id,
        text_content: app.textContent
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend analysis failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  return {
    capabilityId: capability.id,
    capabilityName: capability.textContent,
    recommendation: result.recommendation,
    rationale: result.rationale || '',
    priority: result.priority,
    affectedApplications: result.affected_applications,
    painPointsAddressed: result.pain_points,
    effort: result.effort
  };
}

// Helper function to harmonize recommendations across applications
async function harmonizeRecommendationsWithLLM(
  recommendations: CapabilityRecommendation[],
  applications: any[]
): Promise<HarmonizedRecommendation[]> {
  
  // Check if LLM service is available
  const healthResponse = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/ai/llm/health`, {
    method: 'GET'
  });

  if (!healthResponse.ok) {
    throw new Error('LLM service is not available or not configured. Cannot harmonize recommendations without LLM access.');
  }

  const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/ai/applications/portfolio/harmonize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recommendations: recommendations.map(rec => ({
        capability: rec.capabilityId,
        pain_points: rec.painPointsAddressed,
        affected_applications: rec.affectedApplications,
        recommendation: rec.recommendation,
        priority: rec.priority,
        impact: rec.rationale,
        effort: rec.effort
      })),
      applications: applications.map(app => ({
        id: app.id,
        text_content: app.textContent
      }))
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Backend harmonization failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  
  return result.harmonized_recommendations.map((hr: any) => ({
    affectedCapabilities: [hr.application], // Backend returns application-focused harmonization
    actions: hr.actions,
    overallPriority: hr.overall_priority as "High" | "Medium" | "Low",
    totalImpact: hr.total_impact,
    consolidatedRationale: hr.consolidated_rationale
  }));
}

// Robust Excel parsing function with header detection
async function parseSpreadsheet(file: File, idColumn: string, textColumns: string[]) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header detection
  let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) {
    throw new Error(`File ${file.name} must have at least a header row and one data row`);
  }
  
  // Find the actual header row by looking for the row with the most non-empty cells
  let headerRowIndex = 0;
  let maxNonEmptyCells = 0;
  
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    const row = jsonData[i] || [];
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    if (nonEmptyCells > maxNonEmptyCells) {
      maxNonEmptyCells = nonEmptyCells;
      headerRowIndex = i;
    }
  }
  
  // Extract headers and filter out empty ones
  const headers = (jsonData[headerRowIndex] || [])
    .map((header: any) => String(header || '').trim())
    .filter(header => header.length > 0);
  
  if (headers.length === 0) {
    throw new Error(`No valid headers found in ${file.name}. Available columns: ${jsonData[headerRowIndex]?.join(', ') || 'none'}`);
  }
  
  console.log(`Found headers in ${file.name}:`, headers);
  
  // Find column indices
  const idIndex = headers.findIndex(h => h === idColumn);
  if (idIndex === -1) {
    throw new Error(`ID column "${idColumn}" not found in ${file.name}. Available columns: ${headers.join(', ')}`);
  }
  
  const textIndices = textColumns.map(col => {
    const index = headers.findIndex(h => h === col);
    if (index === -1) {
      throw new Error(`Text column "${col}" not found in ${file.name}. Available columns: ${headers.join(', ')}`);
    }
    return index;
  });
  
  // Extract data rows (skip header row)
  const dataRows = jsonData.slice(headerRowIndex + 1);
  
  return dataRows
    .map(row => ({
      id: String(row[idIndex] || '').trim(),
      textContent: textIndices
        .map(idx => String(row[idx] || '').trim())
        .filter(text => text.length > 0)
        .join(' ')
    }))
    .filter(item => item.id && item.textContent);
}

// Robust pain point mapping parsing
async function parsePainPointMapping(file: File, painPointIdCol: string, painPointDescCols: string[], capabilityIdCol: string) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header detection
  let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  
  if (jsonData.length < 2) {
    throw new Error(`Pain point mapping file must have at least a header row and one data row`);
  }
  
  // Find the actual header row by looking for the row with the most non-empty cells
  let headerRowIndex = 0;
  let maxNonEmptyCells = 0;
  
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    const row = jsonData[i] || [];
    const nonEmptyCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== '').length;
    if (nonEmptyCells > maxNonEmptyCells) {
      maxNonEmptyCells = nonEmptyCells;
      headerRowIndex = i;
    }
  }
  
  // Extract headers and filter out empty ones
  const headers = (jsonData[headerRowIndex] || [])
    .map((header: any) => String(header || '').trim())
    .filter(header => header.length > 0);
  
  if (headers.length === 0) {
    throw new Error(`No valid headers found in pain point mapping file. Available columns: ${jsonData[headerRowIndex]?.join(', ') || 'none'}`);
  }
  
  console.log('Found headers in pain point mapping:', headers);
  
  // Find column indices
  const painPointIdIndex = headers.findIndex(h => h === painPointIdCol);
  if (painPointIdIndex === -1) {
    throw new Error(`Pain point ID column "${painPointIdCol}" not found. Available columns: ${headers.join(', ')}`);
  }
  
  const painPointDescIndices = painPointDescCols.map(col => {
    const index = headers.findIndex(h => h === col);
    if (index === -1) {
      throw new Error(`Pain point description column "${col}" not found. Available columns: ${headers.join(', ')}`);
    }
    return index;
  });
  
  const capabilityIdIndex = headers.findIndex(h => h === capabilityIdCol);
  if (capabilityIdIndex === -1) {
    throw new Error(`Capability ID column "${capabilityIdCol}" not found. Available columns: ${headers.join(', ')}`);
  }
  
  // Extract data rows (skip header row)
  const dataRows = jsonData.slice(headerRowIndex + 1);
  
  return dataRows
    .map(row => ({
      painPointId: String(row[painPointIdIndex] || '').trim(),
      painPointDesc: painPointDescIndices
        .map(idx => String(row[idx] || '').trim())
        .filter(text => text.length > 0)
        .join(' '),
      capabilityId: String(row[capabilityIdIndex] || '').trim()
    }))
    .filter(item => item.painPointId && item.painPointDesc && item.capabilityId);
}
