// Detect if we're in Electron and adjust API base accordingly
const getApiBase = () => {
  if (typeof window !== 'undefined' && window.electronAPI) {
    // In Electron, use localhost backend
    return "http://localhost:8001";
  }
  // In web version, use environment variable or default
  return process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8001";
};

export const API_BASE = getApiBase();

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) } as Record<string, string>;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}
