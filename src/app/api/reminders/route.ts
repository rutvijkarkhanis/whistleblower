import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/reminders — upcoming, not-done reminders (with job label)
// GET /api/reminders?job_id=… — reminders for one job
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("job_id");
  const db = serviceClient();

  let query = db
    .from("follow_up_reminders")
    .select("*, jobs(company, role_title)")
    .order("due_at", { ascending: true });

  if (jobId) query = query.eq("job_id", jobId);
  else query = query.eq("done", false);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminders: data });
}

// POST /api/reminders — { job_id, due_at, note }
export async function POST(req: Request) {
  const body = await req.json();
  if (!body.job_id || !body.due_at) {
    return NextResponse.json({ error: "job_id and due_at are required" }, { status: 400 });
  }
  const db = serviceClient();
  const { data, error } = await db
    .from("follow_up_reminders")
    .insert({ job_id: body.job_id, due_at: body.due_at, note: body.note ?? null })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}
