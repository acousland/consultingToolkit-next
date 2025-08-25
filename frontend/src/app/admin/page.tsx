"use client";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

export default function Admin() {
  const [ping, setPing] = useState<string>("");
  const [llmStatus, setLlmStatus] = useState<null | { enabled: boolean; provider: string; model: string; temperature: number }>(null);
  const [llmHealth, setLlmHealth] = useState<string>("...");
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/ai/ping`).then(r=>r.json()) as {message:string};
        setPing(res.message);
      } catch {
        setPing("error");
      }
      try {
        const status = await fetch(`/api/ai/llm/status`).then(r=>r.json()) as {enabled:boolean; provider:string; model:string; temperature:number};
        setLlmStatus(status);
        if (status.enabled) {
          try {
            const health = await fetch(`/api/ai/llm/health`).then(r=>r.json()) as {status:string};
            setLlmHealth(health.status);
          } catch {
            setLlmHealth(`error`);
          }
        } else {
          setLlmHealth("disabled");
        }
      } catch {
        setLlmStatus(null);
      }
    })();
  }, []);
  return (
    <div className="min-h-screen p-8 -mx-4 sm:-mx-6 lg:-mx-8 -mt-8">
      <div className="mx-auto max-w-5xl space-y-6 pt-8">
        <h1 className="text-4xl font-black">Admin & Testing</h1>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 p-5 bg-black/40">
            <h2 className="text-xl font-semibold mb-2">Backend</h2>
            <div className="space-y-2 text-sm">
              <div>API Base: <code>{API_BASE}</code></div>
              <div>AI Router Ping: <code>{ping || "..."}</code></div>
              <div>
                <a className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/10" href={`${API_BASE}/docs`} target="_blank" rel="noreferrer">
                  Open API Docs
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>
                </a>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 p-5 bg-black/40">
            <h2 className="text-xl font-semibold mb-2">LLM</h2>
            <div className="space-y-2 text-sm">
              {llmStatus ? (
                <>
                  <div>Status: <code>{llmStatus.enabled ? "enabled" : "disabled"}</code></div>
                  <div>Provider: <code>{llmStatus.provider}</code></div>
                  <div>Model: <code>{llmStatus.model}</code></div>
                  <div>Temperature: <code>{llmStatus.temperature}</code></div>
                  <div>Health: <code>{llmHealth}</code></div>
                </>
              ) : (
                <div>Fetching LLM status…</div>
              )}
              <div className="text-xs text-gray-400">Set OPENAI_API_KEY and OPENAI_MODEL in the API environment to enable.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
