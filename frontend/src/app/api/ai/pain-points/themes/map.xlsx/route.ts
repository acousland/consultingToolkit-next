import { API_BASE } from "@/lib/api";

export const runtime = "edge";

export async function POST(req: Request) {
  const formData = await req.formData();
  const res = await fetch(`${API_BASE}/ai/pain-points/themes/map.xlsx`, {
    method: "POST",
    body: formData,
  });
  const headers = new Headers();
  // Pass through key headers to support streaming and proper filename
  const ct = res.headers.get("content-type") || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const cd = res.headers.get("content-disposition") || "attachment; filename=theme_perspective_mapping.xlsx";
  const cl = res.headers.get("content-length");
  headers.set("content-type", ct);
  headers.set("content-disposition", cd);
  if (cl) headers.set("content-length", cl);
  headers.set("cache-control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}
