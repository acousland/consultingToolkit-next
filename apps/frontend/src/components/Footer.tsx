"use client";
import React, { useEffect, useState } from "react";

interface FooterProps { uiVersion: string; }

const Footer: React.FC<FooterProps> = ({ uiVersion }) => {
  const [backendVersion, setBackendVersion] = useState<string>("…");
  const [backendCommit, setBackendCommit] = useState<string>("");
  useEffect(() => {
    let active = true;
    const url = process.env.NEXT_PUBLIC_BACKEND_URL ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/health` : "/api/health";
    fetch(url)
      .then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!active) return;
        if (!r.ok) { setBackendVersion("offline"); return; }
        setBackendVersion(data.backend_version || 'unknown');
        if (data.git_commit) setBackendCommit(String(data.git_commit).substring(0,7));
      })
      .catch(() => { if (active) setBackendVersion("offline"); });
    return () => { active = false; };
  }, []);
  return (
    <div className="fixed bottom-1 right-2 text-[10px] md:text-xs text-gray-400 bg-gray-900/70 backdrop-blur px-2 py-1 rounded border border-gray-700 shadow-sm z-50 select-none">
      <span className="font-mono">UI {uiVersion}</span>
      <span className="mx-1">|</span>
  <span className="font-mono">API {backendVersion}{backendCommit && `@${backendCommit}`}</span>
    </div>
  );
};
export default Footer;
