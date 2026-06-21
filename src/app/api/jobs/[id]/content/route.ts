import { NextResponse } from "next/server";
import { generateContent } from "@/lib/content";
import { serviceClient } from "@/lib/supabase";
import { CONTENT_TYPES, type ContentType, type Job, type Tone } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

const TONES: Tone[] = ["executive", "founder-to-founder", "direct"];

// GET — all generated content for a job (latest version of each type first)
export async function GET(_req: Request, { params }: Ctx) {
  const db = serviceClient();
  const { data, error } = await db
    .from("generated_content")
    .select("*")
    .eq("job_id", params.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data });
}

// POST — generate (or regenerate) one or more content types
// body: { types?: ContentType[]  // defaults to all
//         tone: Tone }
export async function POST(req: Request, { params }: Ctx) {
  try {
    const body = await req.json();
    const tone: Tone = TONES.includes(body.tone) ? body.tone : "executive";
    const types: ContentType[] =
      Array.isArray(body.types) && body.types.length
        ? body.types.filter((t: string) => CONTENT_TYPES.includes(t as ContentType))
        : [...CONTENT_TYPES];

    const db = serviceClient();
    const { data: job, error: jobErr } = await db.from("jobs").select("*").eq("id", params.id).single();
    if (jobErr || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const results = [];
    for (const type of types) {
      const text = await generateContent(job as Job, type, tone);

      // bump version: find current max version for this (job,type)
      const { data: existing } = await db
        .from("generated_content")
        .select("version")
        .eq("job_id", params.id)
        .eq("type", type)
        .order("version", { ascending: false })
        .limit(1);
      const nextVersion = (existing?.[0]?.version ?? 0) + 1;

      const { data: row, error } = await db
        .from("generated_content")
        .insert({ job_id: params.id, type, content: text, tone, version: nextVersion })
        .select("*")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      results.push(row);
    }

    return NextResponse.json({ content: results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 },
    );
  }
}
