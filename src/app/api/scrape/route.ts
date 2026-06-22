import { NextResponse } from "next/server";
import { fetchJobFromUrl } from "@/lib/portals";

export const runtime = "nodejs";
export const maxDuration = 30;

// POST /api/scrape — preview a portal URL parse without storing it
export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const parsed = await fetchJobFromUrl(url);
    return NextResponse.json({ parsed });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to scrape" },
      { status: 500 },
    );
  }
}
