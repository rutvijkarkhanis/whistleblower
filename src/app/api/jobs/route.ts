import { NextResponse } from "next/server";
import { importJob } from "@/lib/jd";
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

// POST /api/jobs — import one job from text or a portal URL, analyze, store
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const job = await importJob({ jd_text: body.jd_text, jd_url: body.jd_url });
    return NextResponse.json({ job });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze JD" },
      { status: 500 },
    );
  }
}
