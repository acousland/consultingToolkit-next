import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const res = await fetch(`${API_BASE}/ai/pain-points/cleanup/report.xlsx`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(json),
    });
    
    // For Excel files, we expect a blob response
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") || ct.includes("application/octet-stream")) {
      const blob = await res.blob();
      return new Response(blob, { 
        status: res.status, 
        headers: { 
          "content-type": ct,
          "content-disposition": res.headers.get("content-disposition") || ""
        } 
      });
    }
    
    return new Response(await res.text(), { status: res.status, headers: { "content-type": ct } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Proxy failed";
    return new Response(JSON.stringify({ detail: msg }), { status: 500, headers: { "content-type": "application/json" } });
  }
}
