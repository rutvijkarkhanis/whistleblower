// ---------------------------------------------------------------------------
// Job discovery via free aggregator APIs.
//   • Jooble  — covers the UAE/Dubai (and 70+ countries). Free key:
//     https://jooble.org/api/about  → set JOOBLE_API_KEY. PRIMARY.
//   • Adzuna  — free key (https://developer.adzuna.com) but DOES NOT cover the
//     UAE; supported countries: at au be br ca ch de es fr gb in it mx nl nz
//     pl sg us za. Used as a fallback for those markets.
// ---------------------------------------------------------------------------

export interface DiscoverResult {
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string; // snippet
  url: string; // link to original posting
  created: string | null;
  salary: string | null;
}

export const PRESET_QUERIES = [
  "Chief of Staff",
  "Founder's Office",
  "Head of Growth",
  "COO",
  "General Manager",
];

const stripHtml = (s: string) => (s || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export function joobleConfigured(): boolean {
  return !!process.env.JOOBLE_API_KEY;
}
export function adzunaConfigured(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}
export function discoverConfigured(): boolean {
  return joobleConfigured() || adzunaConfigured();
}

// Adzuna country codes (UAE intentionally absent — not supported).
const ADZUNA_COUNTRIES = new Set([
  "at","au","be","br","ca","ch","de","es","fr","gb","in","it","mx","nl","nz","pl","sg","us","za",
]);

interface SearchOpts {
  what: string;
  where?: string;
  country?: string; // ISO code; only used by Adzuna
  maxDaysOld?: number;
}

// --- Jooble (UAE-capable) ----------------------------------------------------
async function searchJooble(opts: SearchOpts): Promise<DiscoverResult[]> {
  const key = process.env.JOOBLE_API_KEY!;
  const res = await fetch(`https://jooble.org/api/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: opts.what, location: opts.where || "Dubai" }),
  });
  if (!res.ok) throw new Error(`Jooble error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    jobs?: {
      id?: string | number;
      title?: string;
      company?: string;
      location?: string;
      snippet?: string;
      salary?: string;
      link?: string;
      updated?: string;
    }[];
  };
  return (data.jobs ?? []).map((j) => ({
    external_id: String(j.id ?? j.link ?? Math.random()),
    title: stripHtml(j.title ?? ""),
    company: j.company || "Unknown",
    location: j.location || "",
    description: stripHtml(j.snippet ?? ""),
    url: j.link ?? "",
    created: j.updated ?? null,
    salary: j.salary || null,
  }));
}

// --- Adzuna (fallback, non-UAE markets) --------------------------------------
async function searchAdzuna(opts: SearchOpts): Promise<DiscoverResult[]> {
  const appId = process.env.ADZUNA_APP_ID!;
  const appKey = process.env.ADZUNA_APP_KEY!;
  const country = (opts.country || "gb").toLowerCase();
  if (!ADZUNA_COUNTRIES.has(country)) {
    throw new Error(`Adzuna does not support country "${country}". Add a JOOBLE_API_KEY for UAE/Dubai.`);
  }
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: opts.what,
    results_per_page: "30",
    "content-type": "application/json",
    sort_by: "date",
  });
  if (opts.where) params.set("where", opts.where);
  if (opts.maxDaysOld) params.set("max_days_old", String(opts.maxDaysOld));

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Adzuna error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    results?: {
      id?: string | number;
      title?: string;
      company?: { display_name?: string };
      location?: { display_name?: string };
      description?: string;
      redirect_url?: string;
      created?: string;
      salary_min?: number;
      salary_max?: number;
    }[];
  };
  return (data.results ?? []).map((r) => ({
    external_id: String(r.id ?? r.redirect_url ?? Math.random()),
    title: stripHtml(r.title ?? ""),
    company: r.company?.display_name ?? "Unknown",
    location: r.location?.display_name ?? "",
    description: stripHtml(r.description ?? ""),
    url: r.redirect_url ?? "",
    created: r.created ?? null,
    salary:
      r.salary_min || r.salary_max
        ? `${r.salary_min ?? "?"}–${r.salary_max ?? "?"}`
        : null,
  }));
}

// Provider selection: Jooble first (UAE-capable), else Adzuna.
export async function discoverJobs(opts: SearchOpts): Promise<DiscoverResult[]> {
  if (joobleConfigured()) return searchJooble(opts);
  if (adzunaConfigured()) return searchAdzuna(opts);
  throw new Error("No discovery provider configured — add JOOBLE_API_KEY (covers UAE).");
}
