import { NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || process.env.API_BASE || "http://localhost:8000";

export async function GET() {
  try {
    const r = await fetch(`${API_BASE}/health`, { next: { revalidate: 5 } });
    const data = await r.json();
    return NextResponse.json(data, { status: r.status });
  } catch (e) {
    return NextResponse.json({ status: "error", backend_version: null }, { status: 503 });
  }
}
