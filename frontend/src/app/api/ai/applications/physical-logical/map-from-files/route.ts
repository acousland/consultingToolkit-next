import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/ai/applications/physical-logical/map-from-files`, {
    method: "POST",
    body: formData,
  });
  const text = await res.text();
  return new Response(text, { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
}
