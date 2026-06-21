import { NextResponse } from "next/server";
import { analyzeJd, scrapeJdUrl } from "@/lib/jd";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/jobs — list all jobs (newest first)
export async function GET() {
  const db = serviceClient();
  const { data, error } = await db.from("jobs").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ jobs: data });
}

// POST /api/jobs — analyze a JD (text or url) and store it
export async function POST(req: Request) {
  try {
    const body = await req.json();
    let jdText: string | undefined = body.jd_text;
    const jdUrl: string | undefined = body.jd_url;

    if (!jdText && jdUrl) {
      jdText = await scrapeJdUrl(jdUrl);
    }
    if (!jdText || jdText.trim().length < 40) {
      return NextResponse.json({ error: "Provide jd_text or a scrapeable jd_url" }, { status: 400 });
    }

    const analysis = await analyzeJd(jdText);
    const db = serviceClient();
    const { data, error } = await db
      .from("jobs")
      .insert({
        company: analysis.company,
        role_title: analysis.role_title,
        seniority: analysis.seniority,
        jd_text: jdText,
        jd_url: jdUrl ?? null,
        fit_score: analysis.fit_score,
        fit_breakdown_json: analysis.fit_breakdown,
        keywords: analysis.keywords,
        must_haves: analysis.must_haves,
        nice_to_haves: analysis.nice_to_haves,
        red_flags: analysis.red_flags,
        dubai_signals: analysis.dubai_signals,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ job: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze JD" },
      { status: 500 },
    );
  }
}
