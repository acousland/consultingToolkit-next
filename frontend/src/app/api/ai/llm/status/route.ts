export const dynamic = 'force-dynamic';

import { API_BASE } from "@/lib/api";


export async function GET() {
  const res = await fetch(`${API_BASE}/ai/llm/status`, { headers: { "content-type": "application/json" } });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
}
