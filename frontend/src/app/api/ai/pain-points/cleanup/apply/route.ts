import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const res = await fetch(`${API_BASE}/ai/pain-points/cleanup/apply`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(json),
    });
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return new Response(await res.text(), { status: res.status, headers: { "content-type": ct } });
    }
    return new Response(await res.text(), { status: res.status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy failed";
    return new Response(JSON.stringify({ detail: msg }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
