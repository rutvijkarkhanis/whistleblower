"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { STAGE_LABELS, STAGES, type Job, type Reminder, type Stage } from "@/lib/types";

function scoreColor(score: number | null): string {
  if (score == null) return "text-slate-400";
  if (score >= 75) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-500";
}

const STAGE_ACCENT: Record<Stage, string> = {
  saved: "border-t-slate-400",
  applied: "border-t-blue-400",
  interviewing: "border-t-amber-400",
  offer: "border-t-green-500",
  rejected: "border-t-red-400",
};

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"text" | "url" | "bulk">("text");
  const [jdText, setJdText] = useState("");
  const [jdUrl, setJdUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [bulkResults, setBulkResults] = useState<
    { url: string; ok: boolean; role_title?: string | null; fit_score?: number | null; error?: string }[]
  >([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [jr, rr] = await Promise.all([fetch("/api/jobs"), fetch("/api/reminders")]);
    const jj = await jr.json();
    const rj = await rr.json();
    if (jr.ok) setJobs(jj.jobs ?? []);
    if (rr.ok) setReminders(rj.reminders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setBulkResults([]);
    try {
      if (mode === "bulk") {
        const urls = bulkUrls.split(/\s*\n\s*/).map((u) => u.trim()).filter(Boolean);
        const res = await fetch("/api/jobs/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Failed");
        setBulkResults(json.results ?? []);
        setBulkUrls("");
      } else {
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
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setAnalyzing(false);
    }
  }

  const canSubmit =
    mode === "text" ? !!jdText.trim() : mode === "url" ? !!jdUrl.trim() : !!bulkUrls.trim();

  // Optimistic drag-to-move between stages
  async function moveTo(jobId: string, stage: Stage) {
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, stage } : j)));
    await fetch(`/api/jobs/${jobId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
  }

  async function completeReminder(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/reminders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: true }),
    });
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
            <button
              className={`rounded px-2 py-1 ${mode === "bulk" ? "bg-ink text-white" : "bg-slate-100"}`}
              onClick={() => setMode("bulk")}
            >
              Bulk URLs
            </button>
          </div>
        </div>

        {mode === "text" ? (
          <textarea
            className="input h-32 font-mono text-xs"
            placeholder="Paste the full job description here…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
          />
        ) : mode === "url" ? (
          <input
            className="input"
            placeholder="https://… LinkedIn / Indeed / Bayt / GulfTalent / Greenhouse / Lever job URL"
            value={jdUrl}
            onChange={(e) => setJdUrl(e.target.value)}
          />
        ) : (
          <textarea
            className="input h-32 font-mono text-xs"
            placeholder={"Paste up to 15 job URLs, one per line…\nhttps://www.linkedin.com/jobs/view/...\nhttps://www.bayt.com/en/..."}
            value={bulkUrls}
            onChange={(e) => setBulkUrls(e.target.value)}
          />
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

        {bulkResults.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {bulkResults.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate text-slate-500">{r.url}</span>
                {r.ok ? (
                  <span className="shrink-0 text-green-600">
                    ✓ {r.role_title ?? "imported"} · fit {r.fit_score ?? "—"}
                  </span>
                ) : (
                  <span className="shrink-0 text-red-500">✕ {r.error}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            {mode === "bulk"
              ? "JSON-LD / portal-aware parse, then auto fit-scored."
              : "LinkedIn/Indeed often gate full text behind login — paste text if a URL comes back empty."}
          </span>
          <button className="btn-primary" disabled={analyzing || !canSubmit} onClick={analyze}>
            {analyzing ? (mode === "bulk" ? "Importing…" : "Analyzing…") : mode === "bulk" ? "Import all" : "Analyze & save"}
          </button>
        </div>
      </section>

      {/* Module 4 — follow-up reminders */}
      {reminders.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-2 text-sm font-semibold">⏰ Follow-ups due</h2>
          <ul className="space-y-1">
            {reminders.map((r) => {
              const overdue = new Date(r.due_at) < new Date();
              return (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0">
                    <span className={overdue ? "font-medium text-red-600" : "text-slate-700"}>
                      {new Date(r.due_at).toLocaleDateString()}
                    </span>{" "}
                    <Link href={`/jobs/${r.job_id}`} className="hover:underline">
                      {r.jobs?.role_title ?? "Job"} · {r.jobs?.company ?? ""}
                    </Link>
                    {r.note && <span className="text-slate-500"> — {r.note}</span>}
                  </div>
                  <button className="btn-ghost px-2 py-0.5 text-xs" onClick={() => completeReminder(r.id)}>
                    Done
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Module 4 — Kanban board */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">Pipeline ({jobs.length})</h2>
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {STAGES.map((stage) => {
              const col = jobs.filter((j) => j.stage === stage);
              return (
                <div
                  key={stage}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) moveTo(dragId, stage);
                    setDragId(null);
                  }}
                  className={`min-h-[120px] rounded-lg border border-t-4 border-slate-200 bg-slate-50/60 p-2 ${STAGE_ACCENT[stage]}`}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-xs font-semibold text-slate-600">{STAGE_LABELS[stage]}</span>
                    <span className="text-xs text-slate-400">{col.length}</span>
                  </div>
                  <div className="space-y-2">
                    {col.map((job) => (
                      <div
                        key={job.id}
                        draggable
                        onDragStart={() => setDragId(job.id)}
                        onDragEnd={() => setDragId(null)}
                        className="card cursor-grab p-2 active:cursor-grabbing"
                      >
                        <Link href={`/jobs/${job.id}`} className="block">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-xs font-medium leading-tight">
                              {job.role_title ?? "Untitled"}
                            </span>
                            <span className={`shrink-0 text-sm font-bold ${scoreColor(job.fit_score)}`}>
                              {job.fit_score ?? "—"}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
                            <span className="truncate">{job.company ?? "Unknown"}</span>
                            {job.source && job.source !== "manual" && (
                              <span className="shrink-0 rounded bg-slate-100 px-1 text-[9px] text-slate-500">
                                {job.source}
                              </span>
                            )}
                          </div>
                          {job.dubai_signals?.[0] && (
                            <div className="mt-1 truncate text-[10px] text-slate-500">
                              🌍 {job.dubai_signals[0]}
                            </div>
                          )}
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-400">Drag a card between columns to change its stage.</p>
      </section>
    </div>
  );
}
