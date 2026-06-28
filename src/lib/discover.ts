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

export function serpapiConfigured(): boolean {
  return !!process.env.SERPAPI_KEY;
}
export function careerjetConfigured(): boolean {
  return !!process.env.CAREERJET_AFFID;
}
export function joobleConfigured(): boolean {
  return !!process.env.JOOBLE_API_KEY;
}
export function adzunaConfigured(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}
export function discoverConfigured(): boolean {
  return serpapiConfigured() || careerjetConfigured() || joobleConfigured() || adzunaConfigured();
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

export interface DiscoverResponse {
  results: DiscoverResult[];
  total: number;
  provider: string;
}

// --- Jooble (UAE-capable) ----------------------------------------------------
async function searchJooble(opts: SearchOpts): Promise<DiscoverResponse> {
  const key = process.env.JOOBLE_API_KEY!;
  // Jooble keys are region-locked to the site you registered on. For UAE jobs,
  // set JOOBLE_HOST=ae.jooble.org (and use a key from that site).
  const host = process.env.JOOBLE_HOST || "jooble.org";
  const res = await fetch(`https://${host}/api/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords: opts.what, location: opts.where || "" }),
  });
  if (!res.ok) throw new Error(`Jooble error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    totalCount?: number;
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
  const results = (data.jobs ?? []).map((j) => ({
    external_id: String(j.id ?? j.link ?? Math.random()),
    title: stripHtml(j.title ?? ""),
    company: j.company || "Unknown",
    location: j.location || "",
    description: stripHtml(j.snippet ?? ""),
    url: j.link ?? "",
    created: j.updated ?? null,
    salary: j.salary || null,
  }));
  return { results, total: data.totalCount ?? results.length, provider: "Jooble" };
}

// --- Adzuna (fallback, non-UAE markets) --------------------------------------
async function searchAdzuna(opts: SearchOpts): Promise<DiscoverResponse> {
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
    count?: number;
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
  const results = (data.results ?? []).map((r) => ({
    external_id: String(r.id ?? r.redirect_url ?? Math.random()),
    title: stripHtml(r.title ?? ""),
    company: r.company?.display_name ?? "Unknown",
    location: r.location?.display_name ?? "",
    description: stripHtml(r.description ?? ""),
    url: r.redirect_url ?? "",
    created: r.created ?? null,
    salary: r.salary_min || r.salary_max ? `${r.salary_min ?? "?"}–${r.salary_max ?? "?"}` : null,
  }));
  return { results, total: data.count ?? results.length, provider: "Adzuna" };
}

// --- Careerjet (targets UAE via locale en_AE) --------------------------------
async function searchCareerjet(opts: SearchOpts): Promise<DiscoverResponse> {
  const affid = process.env.CAREERJET_AFFID!;
  const locale = process.env.CAREERJET_LOCALE || "en_AE"; // en_AE = UAE
  const params = new URLSearchParams({
    locale_code: locale,
    keywords: opts.what,
    location: opts.where || "",
    affid,
    user_ip: "203.0.113.1",
    user_agent: "Mozilla/5.0 (compatible; WhistleblowerBot/1.0)",
    pagesize: "30",
    sort: "date",
    contenttype: "application/json",
  });
  const res = await fetch(`https://public.api.careerjet.net/search?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Careerjet error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as {
    type?: string;
    hits?: number;
    jobs?: {
      title?: string;
      description?: string;
      company?: string;
      salary?: string;
      date?: string;
      url?: string;
      locations?: string;
    }[];
  };
  // If the location is ambiguous Careerjet returns type "LOCATIONS" not "JOBS".
  if (data.type && data.type !== "JOBS") {
    return { results: [], total: 0, provider: "Careerjet" };
  }
  const results = (data.jobs ?? []).map((j) => ({
    external_id: String(j.url ?? Math.random()),
    title: stripHtml(j.title ?? ""),
    company: j.company || "Unknown",
    location: j.locations || "",
    description: stripHtml(j.description ?? ""),
    url: j.url ?? "",
    created: j.date ?? null,
    salary: j.salary || null,
  }));
  return { results, total: data.hits ?? results.length, provider: "Careerjet" };
}

// --- SerpApi Google Jobs (aggregates LinkedIn/Indeed/Bayt/etc., key-based) ----
async function searchSerpapi(opts: SearchOpts): Promise<DiscoverResponse> {
  const key = process.env.SERPAPI_KEY!;
  const q = [opts.what, opts.where].filter(Boolean).join(" ");
  const params = new URLSearchParams({ engine: "google_jobs", q, hl: "en", api_key: key });
  // Map recency to Google Jobs date chips.
  const d = opts.maxDaysOld;
  if (d) {
    const chip = d <= 1 ? "today" : d <= 3 ? "3days" : d <= 7 ? "week" : "month";
    params.set("chips", `date_posted:${chip}`);
  }
  const res = await fetch(`https://serpapi.com/search.json?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const data = (await res.json()) as {
    error?: string;
    jobs_results?: {
      job_id?: string;
      title?: string;
      company_name?: string;
      location?: string;
      description?: string;
      detected_extensions?: { posted_at?: string; salary?: string };
      apply_options?: { title?: string; link?: string }[];
      related_links?: { link?: string }[];
      share_link?: string;
    }[];
  };
  if (data.error) throw new Error(`Google Jobs (SerpApi): ${data.error}`);

  const results = (data.jobs_results ?? []).map((j) => ({
    external_id: j.job_id ? j.job_id.slice(0, 64) : String(Math.random()),
    title: stripHtml(j.title ?? ""),
    company: j.company_name ?? "Unknown",
    location: j.location ?? "",
    description: stripHtml(j.description ?? ""),
    url: j.apply_options?.[0]?.link ?? j.related_links?.[0]?.link ?? j.share_link ?? "",
    created: j.detected_extensions?.posted_at ?? null,
    salary: j.detected_extensions?.salary ?? null,
  }));
  return { results, total: results.length, provider: "Google Jobs" };
}

// Provider selection: Google Jobs (broadest) → Careerjet → Jooble → Adzuna.
export async function discoverJobs(opts: SearchOpts): Promise<DiscoverResponse> {
  if (serpapiConfigured()) return searchSerpapi(opts);
  if (careerjetConfigured()) return searchCareerjet(opts);
  if (joobleConfigured()) return searchJooble(opts);
  if (adzunaConfigured()) return searchAdzuna(opts);
  throw new Error("No discovery provider configured — add SERPAPI_KEY (Google Jobs).");
}
