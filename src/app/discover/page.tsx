"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PRESETS = ["Chief of Staff", "Founder's Office", "Head of Growth", "COO", "General Manager"];
const COMPANIES_KEY = "wb_watch_companies";

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
  const [mode, setMode] = useState<"boards" | "aggregator">("boards");
  const [what, setWhat] = useState("Chief of Staff");
  const [where, setWhere] = useState("Dubai");
  const [days, setDays] = useState(30);
  const [companies, setCompanies] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [imports, setImports] = useState<Record<string, ImportState>>({});

  // Persist the company watchlist locally so it survives reloads.
  useEffect(() => {
    const saved = localStorage.getItem(COMPANIES_KEY);
    if (saved) setCompanies(saved);
  }, []);
  useEffect(() => {
    if (companies) localStorage.setItem(COMPANIES_KEY, companies);
  }, [companies]);

  async function search() {
    setSearching(true);
    setError(null);
    setStatus(null);
    setRows([]);
    try {
      const qs =
        mode === "boards"
          ? new URLSearchParams({ companies, what: what === "(any role)" ? "" : what, where })
          : new URLSearchParams({ what, where, days: String(days) });
      const endpoint = mode === "boards" ? "/api/boards" : "/api/discover";
      const res = await fetch(`${endpoint}?${qs.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      const results: Row[] = json.results ?? [];
      setRows(results);
      const total = json.total ?? results.length;
      setStatus(
        results.length === 0
          ? mode === "boards"
            ? `No matching roles from those boards${where ? ` in ${where}` : ""}. Try clearing the location/keyword, or check the company slugs.`
            : `${json.provider ?? "?"} reported ${total} total matches for "${what}" in ${where || "anywhere"}. ${
                json.provider === "Adzuna"
                  ? "Adzuna doesn't cover the UAE."
                  : "Try clearing the location, or a broader keyword."
              }`
          : `${results.length} role${results.length === 1 ? "" : "s"} via ${json.provider ?? "?"}`,
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

      {/* Mode toggle */}
      <div className="flex gap-1 text-xs">
        <button
          className={`rounded px-3 py-1 ${mode === "boards" ? "bg-ink text-white" : "bg-slate-100"}`}
          onClick={() => setMode("boards")}
        >
          Company boards
        </button>
        <button
          className={`rounded px-3 py-1 ${mode === "aggregator" ? "bg-ink text-white" : "bg-slate-100"}`}
          onClick={() => setMode("aggregator")}
        >
          Aggregator
        </button>
      </div>

      {/* Search controls */}
      <section className="card p-4">
        {mode === "boards" && (
          <div className="mb-3">
            <label className="text-xs font-medium text-slate-600">Company watchlist</label>
            <textarea
              className="input mt-1 h-24 font-mono text-xs"
              placeholder={"One company per line — a careers URL or platform:slug, e.g.\ngreenhouse:careem\nlever:talabat\nhttps://jobs.ashbyhq.com/tabby"}
              value={companies}
              onChange={(e) => setCompanies(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Pulls live roles straight from Greenhouse / Lever / Ashby boards — no key, no limits. Saved on this device.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            className="input flex-1"
            placeholder={mode === "boards" ? "Filter by role keyword (optional)" : "Role keyword (e.g. Chief of Staff)"}
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <input
            className="input w-32"
            placeholder="Where"
            value={where}
            onChange={(e) => setWhere(e.target.value)}
          />
          {mode === "aggregator" && (
            <select
              className="rounded-md border border-slate-300 px-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          )}
          <button
            className="btn-primary"
            disabled={searching || (mode === "boards" ? !companies.trim() : !what.trim())}
            onClick={search}
          >
            {searching ? "Searching…" : mode === "boards" ? "Pull roles" : "Find jobs"}
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {(mode === "boards" ? ["(any role)", ...PRESETS] : PRESETS).map((p) => (
            <button key={p} className={`chip ${what === p ? "bg-ink text-white" : ""}`} onClick={() => setWhat(p)}>
              {p}
            </button>
          ))}
        </div>

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
