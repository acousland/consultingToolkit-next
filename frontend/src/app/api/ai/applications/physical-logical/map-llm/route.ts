import { API_BASE } from "@/lib/api";
export const runtime = "edge";
export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/ai/applications/physical-logical/map-llm`, { method:"POST", headers:{"content-type":"application/json"}, body });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
}
