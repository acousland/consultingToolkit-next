"use client";
import { useEffect, useState } from "react";
import { API_BASE, api } from "@/lib/api";

export default function Admin() {
  const [ping, setPing] = useState<string>("");
  useEffect(() => {
    (async () => {
      try {
        const res = await api<{message:string}>("/ai/ping");
        setPing(res.message);
      } catch {
        setPing("error");
      }
    })();
  }, []);
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-3">
        <h1 className="text-3xl font-bold">Admin & Testing</h1>
        <div>API Base: <code>{API_BASE}</code></div>
        <div>AI Router Ping: <code>{ping || "..."}</code></div>
        <a className="text-blue-700 underline" href={`${API_BASE}/docs`} target="_blank">Open API Docs</a>
      </div>
    </main>
  );
}
