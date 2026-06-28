// ---------------------------------------------------------------------------
// Company career-board discovery — Greenhouse / Lever / Ashby.
// Public JSON endpoints: no API key, no IP allowlist, works on serverless.
// You supply a watchlist of companies; we pull their live roles and filter.
// ---------------------------------------------------------------------------

import type { DiscoverResult } from "./discover";

export type BoardPlatform = "greenhouse" | "lever" | "ashby";

export interface BoardRef {
  platform: BoardPlatform;
  slug: string;
}

function decodeEntities(s: string): string {
  return (s || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}
function toText(html: string, max = 320): string {
  const t = decodeEntities(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

// Parse "platform:slug", a board URL, or (bare slug → unknown, try all).
export function parseBoardRef(input: string): BoardRef[] {
  const raw = input.trim();
  if (!raw) return [];

  const explicit = raw.match(/^(greenhouse|lever|ashby)\s*:\s*([\w-]+)$/i);
  if (explicit) return [{ platform: explicit[1].toLowerCase() as BoardPlatform, slug: explicit[2] }];

  // URLs
  let m: RegExpMatchArray | null;
  if ((m = raw.match(/greenhouse\.io\/(?:embed\/job_board\?for=)?([\w-]+)/i)))
    return [{ platform: "greenhouse", slug: m[1] }];
  if ((m = raw.match(/boards\.greenhouse\.io\/([\w-]+)/i))) return [{ platform: "greenhouse", slug: m[1] }];
  if ((m = raw.match(/lever\.co\/([\w-]+)/i))) return [{ platform: "lever", slug: m[1] }];
  if ((m = raw.match(/ashbyhq\.com\/([\w-]+)/i))) return [{ platform: "ashby", slug: m[1] }];

  // Bare slug: unknown platform → try all three.
  if (/^[\w-]+$/.test(raw)) {
    return [
      { platform: "greenhouse", slug: raw },
      { platform: "lever", slug: raw },
      { platform: "ashby", slug: raw },
    ];
  }
  return [];
}

async function fetchGreenhouse(slug: string): Promise<DiscoverResult[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: { id?: number; title?: string; location?: { name?: string }; content?: string; absolute_url?: string; updated_at?: string }[];
  };
  return (data.jobs ?? []).map((j) => ({
    external_id: `gh-${slug}-${j.id ?? j.absolute_url}`,
    title: j.title ?? "",
    company: slug,
    location: j.location?.name ?? "",
    description: toText(j.content ?? ""),
    url: j.absolute_url ?? "",
    created: j.updated_at ?? null,
    salary: null,
  }));
}

async function fetchLever(slug: string): Promise<DiscoverResult[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${slug}?mode=json`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    text?: string;
    categories?: { location?: string };
    descriptionPlain?: string;
    hostedUrl?: string;
    createdAt?: number;
    id?: string;
  }[];
  return (Array.isArray(data) ? data : []).map((j) => ({
    external_id: `lv-${slug}-${j.id ?? j.hostedUrl}`,
    title: j.text ?? "",
    company: slug,
    location: j.categories?.location ?? "",
    description: toText(j.descriptionPlain ?? ""),
    url: j.hostedUrl ?? "",
    created: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    salary: null,
  }));
}

async function fetchAshby(slug: string): Promise<DiscoverResult[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: {
      id?: string;
      title?: string;
      location?: string;
      descriptionPlain?: string;
      descriptionHtml?: string;
      jobUrl?: string;
      applyUrl?: string;
      publishedAt?: string;
    }[];
  };
  return (data.jobs ?? []).map((j) => ({
    external_id: `ash-${slug}-${j.id ?? j.jobUrl}`,
    title: j.title ?? "",
    company: slug,
    location: j.location ?? "",
    description: toText(j.descriptionPlain || j.descriptionHtml || ""),
    url: j.jobUrl || j.applyUrl || "",
    created: j.publishedAt ?? null,
    salary: null,
  }));
}

async function fetchOne(ref: BoardRef): Promise<DiscoverResult[]> {
  try {
    if (ref.platform === "greenhouse") return await fetchGreenhouse(ref.slug);
    if (ref.platform === "lever") return await fetchLever(ref.slug);
    return await fetchAshby(ref.slug);
  } catch {
    return [];
  }
}

const UAE_TERMS = ["dubai", "abu dhabi", "uae", "united arab emirates", "emirat", "sharjah"];

// Fetch all companies' boards, filter by location + optional keyword.
export async function fetchBoards(opts: {
  companies: string[];
  what?: string;
  where?: string;
}): Promise<DiscoverResult[]> {
  const refs = opts.companies.flatMap(parseBoardRef);
  const batches = await Promise.all(refs.map(fetchOne));

  const seen = new Set<string>();
  const all: DiscoverResult[] = [];
  for (const b of batches) {
    for (const j of b) {
      if (!j.title || !j.url || seen.has(j.url)) continue;
      seen.add(j.url);
      all.push(j);
    }
  }

  const what = opts.what?.trim().toLowerCase();
  const where = opts.where?.trim().toLowerCase();
  const wantUae = !!where && UAE_TERMS.some((t) => where.includes(t));

  return all.filter((j) => {
    if (what && !j.title.toLowerCase().includes(what)) return false;
    if (where) {
      const loc = j.location.toLowerCase();
      const match = wantUae ? UAE_TERMS.some((t) => loc.includes(t)) : loc.includes(where);
      if (!match) return false;
    }
    return true;
  });
}
