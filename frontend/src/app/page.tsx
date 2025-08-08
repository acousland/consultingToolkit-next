"use client";
import { useState } from "react";
import { api, API_BASE } from "@/lib/api";

type EvalReq = { use_case: string; company_context?: string };
interface EvalRes {
  scores: Record<string, number>;
  rationale: Record<string, string>;
}

type EthicsReq = { use_case: string };
interface EthicsRes {
  deontological: { summary: string; score: number };
  utilitarian: { summary: string; score: number };
  social_contract: { summary: string; score: number };
  virtue: { summary: string; score: number };
  summary: { composite: number; recommendation: string };
}

export default function Home() {
  const [useCase, setUseCase] = useState("");
  const [context, setContext] = useState("");
  const [evalLoading, setEvalLoading] = useState(false);
  const [ethicsLoading, setEthicsLoading] = useState(false);
  const [evalRes, setEvalRes] = useState<EvalRes | null>(null);
  const [ethicsRes, setEthicsRes] = useState<EthicsRes | null>(null);
  const [error, setError] = useState<string>("");

  async function onEvaluate() {
    setError("");
    setEvalRes(null);
    setEvalLoading(true);
    try {
      const body: EvalReq = { use_case: useCase, company_context: context || undefined };
      const res = await api<EvalRes>("/ai/use-case/evaluate", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setEvalRes(res);
    } catch (e: any) {
      setError(e?.message || "Evaluation failed");
    } finally {
      setEvalLoading(false);
    }
  }

  async function onEthics() {
    setError("");
    setEthicsRes(null);
    setEthicsLoading(true);
    try {
      const body: EthicsReq = { use_case: useCase };
      const res = await api<EthicsRes>("/ai/ethics/review", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setEthicsRes(res);
    } catch (e: any) {
      setError(e?.message || "Ethics review failed");
    } finally {
      setEthicsLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-8 bg-white text-gray-900">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold">Consulting Toolkit (Next.js + FastAPI)</h1>
          <p className="text-gray-500 mt-2">API Base: {API_BASE}</p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-3">
            <label className="block text-sm font-medium">Use Case</label>
            <textarea
              className="w-full h-40 p-3 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Describe the AI use case..."
              value={useCase}
              onChange={(e) => setUseCase(e.target.value)}
            />
          </div>
          <div className="space-y-3">
            <label className="block text-sm font-medium">Company Context (optional)</label>
            <textarea
              className="w-full h-40 p-3 rounded border focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add relevant company context..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </div>
        </section>

        {error && (
          <div className="mt-4 p-4 rounded border border-red-300 text-red-700">{error}</div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onEvaluate}
            disabled={evalLoading || !useCase}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {evalLoading ? "Evaluating..." : "Evaluate Use Case"}
          </button>
          <button
            onClick={onEthics}
            disabled={ethicsLoading || !useCase}
            className="px-4 py-2 rounded bg-gray-900 text-white disabled:opacity-50"
          >
            {ethicsLoading ? "Reviewing Ethics..." : "Run Ethics Review"}
          </button>
        </div>

        {evalRes && (
          <section className="mt-8 grid gap-4">
            <h2 className="text-2xl font-semibold">Use Case Evaluation</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(evalRes.scores).map(([k, v]) => (
                <div key={k} className="p-4 rounded border">
                  <div className="text-sm text-gray-500">{k.replace(/_/g, " ")}</div>
                  <div className="text-3xl font-bold">{v}/100</div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(evalRes.rationale).map(([k, v]) => (
                <div key={k} className="p-4 rounded border">
                  <div className="text-sm font-medium">{k.replace(/_/g, " ")}</div>
                  <p className="text-sm text-gray-600 mt-1">{v}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {ethicsRes && (
          <section className="mt-8 grid gap-4">
            <h2 className="text-2xl font-semibold">Ethics Review</h2>
            <div className="grid gap-3 md:grid-cols-4">
              {([
                ["Deontological", ethicsRes.deontological],
                ["Utilitarian", ethicsRes.utilitarian],
                ["Social Contract", ethicsRes.social_contract],
                ["Virtue", ethicsRes.virtue],
              ] as const).map(([label, obj]) => (
                <div key={label} className="p-4 rounded border">
                  <div className="text-sm text-gray-500">{label}</div>
                  <div className="text-3xl font-bold">{obj.score}/10</div>
                  <p className="text-sm text-gray-600 mt-1">{obj.summary}</p>
                </div>
              ))}
            </div>
            <div className="p-4 rounded border">
              <div className="text-sm text-gray-500">Composite</div>
              <div className="text-2xl font-bold">{ethicsRes.summary.composite}/10</div>
              <div className="mt-1">Recommendation: <span className="font-semibold">{ethicsRes.summary.recommendation}</span></div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
