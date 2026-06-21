"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CONTENT_LABELS,
  CONTENT_TYPES,
  type ContentType,
  type GeneratedContent,
  type Job,
  type Stage,
  type Tone,
} from "@/lib/types";

const TONES: Tone[] = ["executive", "founder-to-founder", "direct"];
const STAGES: Stage[] = ["saved", "applied", "interviewing", "offer", "rejected"];

export default function JobDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const [job, setJob] = useState<Job | null>(null);
  const [content, setContent] = useState<GeneratedContent[]>([]);
  const [tone, setTone] = useState<Tone>("executive");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadJob() {
    const res = await fetch(`/api/jobs/${id}`);
    const json = await res.json();
    if (res.ok) setJob(json.job);
  }
  async function loadContent() {
    const res = await fetch(`/api/jobs/${id}/content`);
    const json = await res.json();
    if (res.ok) setContent(json.content ?? []);
  }

  useEffect(() => {
    loadJob();
    loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // latest version per type
  const latest = new Map<ContentType, GeneratedContent>();
  for (const c of [...content].sort((a, b) => a.version - b.version)) {
    latest.set(c.type, c);
  }

  async function generate(types?: ContentType[]) {
    setBusy(types?.length === 1 ? types[0] : "all");
    setError(null);
    try {
      const res = await fetch(`/api/jobs/${id}/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone, types }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      await loadContent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function updateStage(stage: Stage) {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    loadJob();
  }

  if (!job) return <p className="text-sm text-slate-500">Loading…</p>;

  const fit = job.fit_breakdown_json;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-xs text-slate-500 hover:underline">
        ← Pipeline
      </Link>

      {/* Header + fit */}
      <section className="card p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">{job.role_title}</h1>
            <p className="text-sm text-slate-500">
              {job.company} · {job.seniority}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-ink">{job.fit_score}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">overall fit</div>
          </div>
        </div>

        {fit && (
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            {(["gtm", "founders_office", "dubai_gcc", "industry"] as const).map((d) => (
              <div key={d} className="rounded bg-slate-50 p-2">
                <div className="text-base font-bold">{fit[d]}</div>
                <div className="text-slate-500">{d.replace("_", " ")}</div>
              </div>
            ))}
          </div>
        )}
        {fit?.rationale && <p className="mt-3 text-sm text-slate-700">{fit.rationale}</p>}

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {job.dubai_signals?.length ? (
            <Tags label="🌍 Dubai/GCC" items={job.dubai_signals} />
          ) : null}
          {job.keywords?.length ? <Tags label="🔑 ATS" items={job.keywords} /> : null}
          {job.red_flags?.length ? <Tags label="🚩 Red flags" items={job.red_flags} danger /> : null}
        </div>

        <div className="mt-4 flex items-center gap-2">
          <span className="text-xs text-slate-500">Stage:</span>
          {STAGES.map((s) => (
            <button
              key={s}
              onClick={() => updateStage(s)}
              className={`chip ${job.stage === s ? "bg-ink text-white" : ""}`}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      {/* Module 2 — content generation */}
      <section className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Generate content</h2>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as Tone)}
            >
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={!!busy} onClick={() => generate()}>
              {busy === "all" ? "Generating…" : "Generate all"}
            </button>
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-red-600">{error}</p>}

        <div className="space-y-3">
          {CONTENT_TYPES.map((type) => (
            <ContentBlock
              key={type}
              type={type}
              row={latest.get(type) ?? null}
              busy={busy === type}
              disabled={!!busy}
              onGenerate={() => generate([type])}
              onSaved={loadContent}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Tags({ label, items, danger }: { label: string; items: string[]; danger?: boolean }) {
  return (
    <div>
      <span className="mr-1 font-medium text-slate-500">{label}:</span>
      {items.map((it, i) => (
        <span key={i} className={`chip mr-1 ${danger ? "bg-red-50 text-red-600" : ""}`}>
          {it}
        </span>
      ))}
    </div>
  );
}

function ContentBlock({
  type,
  row,
  busy,
  disabled,
  onGenerate,
  onSaved,
}: {
  type: ContentType;
  row: GeneratedContent | null;
  busy: boolean;
  disabled: boolean;
  onGenerate: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);

  async function save() {
    if (!row) return;
    await fetch(`/api/content/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setEditing(false);
    onSaved();
  }

  async function copy() {
    if (!row?.content) return;
    await navigator.clipboard.writeText(row.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }

  return (
    <div className="rounded-md border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <div className="text-sm font-medium">
          {CONTENT_LABELS[type]}
          {row && (
            <span className="ml-2 text-[10px] text-slate-400">
              v{row.version} · {row.tone}
              {row.edited ? " · edited" : ""}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {row?.content && (
            <>
              <button className="btn-ghost px-2 py-1 text-xs" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                className="btn-ghost px-2 py-1 text-xs"
                onClick={() => {
                  setDraft(row.content ?? "");
                  setEditing((e) => !e);
                }}
              >
                {editing ? "Cancel" : "Edit"}
              </button>
            </>
          )}
          <button className="btn-ghost px-2 py-1 text-xs" disabled={disabled} onClick={onGenerate}>
            {busy ? "…" : row ? "Regenerate" : "Generate"}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="p-3">
          <textarea className="input h-48 font-mono text-xs" value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mt-2 flex justify-end">
            <button className="btn-primary" onClick={save}>
              Save edit
            </button>
          </div>
        </div>
      ) : row?.content ? (
        <pre className="whitespace-pre-wrap px-3 py-3 text-sm text-slate-800">{row.content}</pre>
      ) : (
        <p className="px-3 py-3 text-xs text-slate-400">Not generated yet.</p>
      )}
    </div>
  );
}
