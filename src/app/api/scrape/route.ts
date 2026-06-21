import { NextResponse } from "next/server";
import { scrapeJdUrl } from "@/lib/jd";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }
    const text = await scrapeJdUrl(url);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to scrape" },
      { status: 500 },
    );
  }
}
