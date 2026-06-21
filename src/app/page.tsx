"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Job } from "@/lib/types";

const STAGE_COLORS: Record<string, string> = {
  saved: "bg-slate-100 text-slate-700",
  applied: "bg-blue-100 text-blue-700",
  interviewing: "bg-amber-100 text-amber-700",
  offer: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"text" | "url">("text");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/jobs");
    const json = await res.json();
    if (res.ok) setJobs(json.jobs ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    try {
      const body = mode === "url" ? { jd_url: jdUrl } : { jd_text: jdText };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setJdText("");
      setJdUrl("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Module 1 — JD intake */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Analyze a JD</h2>
          <div className="flex gap-1 text-xs">
            <button
              className={`rounded px-2 py-1 ${mode === "text" ? "bg-ink text-white" : "bg-slate-100"}`}
              onClick={() => setMode("text")}
            >
              Paste text
            </button>
            <button
              className={`rounded px-2 py-1 ${mode === "url" ? "bg-ink text-white" : "bg-slate-100"}`}
              onClick={() => setMode("url")}
            >
              From URL
            </button>
          </div>
        </div>

        {mode === "text" ? (
          <textarea
            className="input h-40 font-mono text-xs"
            placeholder="Paste the full job description here…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        ) : (
          <input
            className="input"
            placeholder="https://… (will be scraped)"
            value={jdUrl}
            onChange={(e) => setJdUrl(e.target.value)}
          />
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        <div className="mt-3 flex justify-end">
          <button
            className="btn-primary"
            disabled={analyzing || (mode === "text" ? !jdText.trim() : !jdUrl.trim())}
            onClick={analyze}
          >
            {analyzing ? "Analyzing…" : "Analyze & save"}
          </button>
        </div>
      </section>

      {/* Pipeline list */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Pipeline ({jobs.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-slate-500">No jobs yet. Analyze a JD above to get started.</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="card flex items-center justify-between p-3 hover:border-ink"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {job.role_title ?? "Untitled role"}{" "}
                    <span className="text-slate-400">· {job.company ?? "Unknown"}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className={`chip ${STAGE_COLORS[job.stage]}`}>{job.stage}</span>
                    {job.dubai_signals?.slice(0, 2).map((s, i) => (
                      <span key={i} className="chip">
                        🌍 {s.length > 28 ? s.slice(0, 28) + "…" : s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`ml-3 shrink-0 text-right ${scoreColor(job.fit_score)}`}>
                  <div className="text-2xl font-bold leading-none">{job.fit_score ?? "—"}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-400">fit</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
