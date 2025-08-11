import { API_BASE } from "@/lib/api";
export const runtime = "edge";
export async function POST(req: Request) {
  const body = await req.text();
  const res = await fetch(`${API_BASE}/ai/applications/physical-logical/export.xlsx`, { method:"POST", headers:{"content-type":"application/json"}, body });
  const headers = new Headers(res.headers); headers.delete("content-encoding");
  return new Response(await res.arrayBuffer(), { status: res.status, headers });
}
