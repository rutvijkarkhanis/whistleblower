import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const db = serviceClient();
  const { data, error } = await db.from("jobs").select("*").eq("id", params.id).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ job: data });
}

// PATCH — update stage / notes
export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.stage === "string") patch.stage = body.stage;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const db = serviceClient();
  const { data, error } = await db.from("jobs").update(patch).eq("id", params.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ job: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const db = serviceClient();
  const { error } = await db.from("jobs").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
