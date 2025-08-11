import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/ai/applications/physical-logical/map.xlsx`, {
    method: "POST",
    body: formData,
  });
  const headers = new Headers(res.headers);
  headers.delete("content-encoding");
  return new Response(await res.arrayBuffer(), { status: res.status, headers });
}
