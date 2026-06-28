"use client";

import Link from "next/link";
import { useState } from "react";

const PRESETS = ["Chief of Staff", "Founder's Office", "Head of Growth", "COO", "General Manager"];

interface Row {
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  created: string | null;
  salary: string | null;
  already?: boolean;
}

type ImportState = { status: "idle" | "importing" | "done" | "error"; fit?: number | null; job_id?: string; error?: string };

export default function Discover() {
  const [what, setWhat] = useState("Chief of Staff");
  const [where, setWhere] = useState("Dubai");
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imports, setImports] = useState<Record<string, ImportState>>({});

  async function search() {
    setSearching(true);
    setError(null);
    setStatus(null);
    setRows([]);
    try {
      const qs = new URLSearchParams({ what, where, days: String(days) });
      const res = await fetch(`/api/discover?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      const results: Row[] = json.results ?? [];
      setRows(results);
      const total = json.total ?? results.length;
      setStatus(
        results.length === 0
          ? `${json.provider ?? "?"} reported ${total} total matches for "${what}" in ${where || "anywhere"}. ${
              json.provider === "Adzuna"
                ? "Adzuna doesn't cover the UAE — add a free JOOBLE_API_KEY."
                : "Try clearing the location, or a broader keyword."
            }`
          : `${results.length} shown (of ${total}) via ${json.provider ?? "?"}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function importRow(r: Row) {
    setImports((p) => ({ ...p, [r.external_id]: { status: "importing" } }));
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jd_text: r.description,
          jd_url: r.url,
          source: "Adzuna",
          company: r.company,
          role_title: r.title,
          location: r.location,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImports((p) => ({
        ...p,
        [r.external_id]: { status: "done", fit: json.job.fit_score, job_id: json.job.id },
      }));
    } catch (err) {
      setImports((p) => ({
        ...p,
        [r.external_id]: { status: "error", error: err instanceof Error ? err.message : "Failed" },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-semibold">Discover jobs</h1>
        <Link href="/" className="text-xs text-slate-500 hover:underline">
          ← Pipeline
        </Link>
      </div>

      {/* Search controls */}
      <section className="card p-4">
        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            placeholder="Role keyword (e.g. Chief of Staff)"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && what.trim() && search()}
          />
          <input
            className="input w-32"
            placeholder="Where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
          />
          <select
            className="rounded-md border border-slate-300 px-2 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
          <button className="btn-primary" disabled={searching || !what.trim()} onClick={search}>
            {searching ? "Searching…" : "Find jobs"}
          </button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p}
              className={`chip ${what === p ? "bg-ink text-white" : ""}`}
              onClick={() => setWhat(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Live listings via Jooble (covers Dubai/UAE). Import runs the full fit-score analysis on each.
        </p>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {status && !error && <p className="mt-2 text-xs text-slate-500">{status}</p>}
      </section>

      {/* Results */}
      {rows.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs text-slate-500">{rows.length} results</p>
          {rows.map((r) => {
            const st = imports[r.external_id];
            return (
              <div key={r.external_id} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{r.title}</div>
                    <div className="text-xs text-slate-500">
                      {r.company}
                      {r.location ? ` · ${r.location}` : ""}
                      {r.salary ? ` · ${r.salary}` : ""}
                      {r.created ? ` · ${new Date(r.created).toLocaleDateString()}` : ""}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {st?.status === "done" ? (
                      <Link href={`/jobs/${st.job_id}`} className="text-xs text-green-600 hover:underline">
                        ✓ imported · fit {st.fit ?? "—"} ↗
                      </Link>
                    ) : r.already ? (
                      <span className="text-xs text-slate-400">already saved</span>
                    ) : (
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        disabled={st?.status === "importing"}
                        onClick={() => importRow(r)}
                      >
                        {st?.status === "importing" ? "Importing…" : "Import"}
                      </button>
                    )}
                    {r.url && (
                      <a href={r.url} target="_blank" rel="noreferrer" className="text-[11px] text-slate-400 hover:underline">
                        open ↗
                      </a>
                    )}
                    {st?.status === "error" && <span className="text-[11px] text-red-500">{st.error}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
