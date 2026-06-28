import { NextResponse } from "next/server";
import { adzunaConfigured, discoverConfigured, discoverJobs, joobleConfigured } from "@/lib/discover";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/discover?what=Chief of Staff&where=Dubai&days=30
// Returns live listings, flagging any already in your pipeline (by url).
export async function GET(req: Request) {
  if (!discoverConfigured()) {
    return NextResponse.json(
      { error: "No discovery provider configured — add JOOBLE_API_KEY (free, covers UAE) in your env." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const what = searchParams.get("what")?.trim();
  const where = searchParams.get("where")?.trim() || "Dubai";
  const days = Number(searchParams.get("days") || "30");
  if (!what) return NextResponse.json({ error: "what is required" }, { status: 400 });

  try {
    const results = await discoverJobs({ what, where, maxDaysOld: days });

    // Flag results already imported (dedupe by jd_url).
    const db = serviceClient();
    const { data: existing } = await db.from("jobs").select("jd_url");
    const seen = new Set((existing ?? []).map((j: { jd_url: string | null }) => j.jd_url).filter(Boolean));
    const flagged = results.map((r) => ({ ...r, already: seen.has(r.url) }));
    const provider = joobleConfigured() ? "Jooble" : adzunaConfigured() ? "Adzuna" : "none";

    return NextResponse.json({ results: flagged, provider });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Search failed" },
      { status: 500 },
    );
  }
}
