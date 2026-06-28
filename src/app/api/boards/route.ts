import { NextResponse } from "next/server";
import { fetchBoards } from "@/lib/boards";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/boards?companies=greenhouse:careem,lever:talabat&what=&where=Dubai
// Pulls live roles from company ATS boards (no key/IP needed), filters them,
// and flags any already in the pipeline.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const companies = (searchParams.get("companies") || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const what = (searchParams.get("what") || "").trim();
  const where = (searchParams.get("where") || "").trim();

  if (companies.length === 0) {
    return NextResponse.json({ error: "Add at least one company (URL or platform:slug)" }, { status: 400 });
  }

  try {
    const results = await fetchBoards({ companies, what, where });

    const db = serviceClient();
    const { data: existing } = await db.from("jobs").select("jd_url");
    const seen = new Set((existing ?? []).map((j: { jd_url: string | null }) => j.jd_url).filter(Boolean));
    const flagged = results.map((r) => ({ ...r, already: seen.has(r.url) }));

    return NextResponse.json({ results: flagged, total: results.length, provider: "Company boards" });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Board fetch failed" },
      { status: 500 },
    );
  }
}
