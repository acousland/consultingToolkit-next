import { API_BASE } from "@/lib/api";
export const runtime = "edge";
export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/ai/applications/physical-logical/map-from-files-llm-stream`, { method:"POST", body: formData });
  // Stream back directly; don't buffer entire body.
  const headers = new Headers(res.headers);
  return new Response(res.body, { status: res.status, headers });
}
