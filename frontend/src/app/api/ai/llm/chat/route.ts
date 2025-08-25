export const dynamic = 'force-dynamic';

import { API_BASE } from "@/lib/api";


export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/ai/llm/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const text = await res.text();
  return new Response(text, { 
    status: res.status, 
    headers: { "content-type": res.headers.get("content-type") || "application/json" } 
  });
}
