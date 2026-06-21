import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

// PATCH — toggle done / edit note or due_at
export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (typeof body.done === "boolean") patch.done = body.done;
  if (typeof body.note === "string") patch.note = body.note;
  if (typeof body.due_at === "string") patch.due_at = body.due_at;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  const db = serviceClient();
  const { data, error } = await db
    .from("follow_up_reminders")
    .update(patch)
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const db = serviceClient();
  const { error } = await db.from("follow_up_reminders").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
