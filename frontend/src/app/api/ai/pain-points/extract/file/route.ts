import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/ai/pain-points/extract/file`, {
    method: "POST",
    body: formData,
  });
  return new Response(await res.text(), { status: res.status, headers: { "content-type": res.headers.get("content-type") || "application/json" } });
}
