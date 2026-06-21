import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

// PATCH — manual edit of a generated content row
export async function PATCH(req: Request, { params }: Ctx) {
  const body = await req.json();
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  const db = serviceClient();
  const { data, error } = await db
    .from("generated_content")
    .update({ content: body.content, edited: true })
    .eq("id", params.id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ content: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const db = serviceClient();
  const { error } = await db.from("generated_content").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
