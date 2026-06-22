import { NextResponse } from "next/server";
import { importJob } from "@/lib/jd";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_URLS = 15;

// POST /api/jobs/import — bulk import from a list of portal URLs.
// body: { urls: string[] }
// Returns per-URL results so partial failures don't sink the batch.
export async function POST(req: Request) {
  const body = await req.json();
  const urls: string[] = Array.isArray(body.urls)
    ? body.urls.map((u: string) => u.trim()).filter(Boolean)
    : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "Provide a non-empty urls array" }, { status: 400 });
  }
  if (urls.length > MAX_URLS) {
    return NextResponse.json({ error: `Max ${MAX_URLS} URLs per batch` }, { status: 400 });
  }

  const results = [];
  for (const url of urls) {
    try {
      const job = await importJob({ jd_url: url });
      results.push({ url, ok: true, job_id: job.id, role_title: job.role_title, fit_score: job.fit_score });
    } catch (err) {
      results.push({ url, ok: false, error: err instanceof Error ? err.message : "Failed" });
    }
  }

  return NextResponse.json({ results });
}
