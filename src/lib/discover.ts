// ---------------------------------------------------------------------------
// Job discovery via Adzuna (free aggregator API, covers the UAE/Dubai market).
// Get a free app_id + app_key at https://developer.adzuna.com
// ---------------------------------------------------------------------------

export interface DiscoverResult {
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string; // snippet
  url: string; // redirect to original posting
  created: string | null;
  salary_min: number | null;
  salary_max: number | null;
}

// Sensible defaults for Rutvij's search.
export const PRESET_QUERIES = [
  "Chief of Staff",
  "Founder's Office",
  "Head of Growth",
  "COO",
  "General Manager",
];

export function adzunaConfigured(): boolean {
  return !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
}

export async function searchAdzuna(opts: {
  what: string;
  where?: string;
  country?: string; // ISO code, default "ae" (UAE)
  page?: number;
  resultsPerPage?: number;
  maxDaysOld?: number;
}): Promise<DiscoverResult[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error("Adzuna not configured — add ADZUNA_APP_ID and ADZUNA_APP_KEY.");
  }

  const country = (opts.country || "ae").toLowerCase();
  const page = opts.page ?? 1;
  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: opts.what,
    results_per_page: String(opts.resultsPerPage ?? 20),
    "content-type": "application/json",
    sort_by: "date",
  });
  if (opts.where) params.set("where", opts.where);
  if (opts.maxDaysOld) params.set("max_days_old", String(opts.maxDaysOld));

  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`Adzuna error ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

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
    title: (r.title ?? "").replace(/<[^>]+>/g, "").trim(),
    company: r.company?.display_name ?? "Unknown",
    location: r.location?.display_name ?? "",
    description: (r.description ?? "").replace(/<[^>]+>/g, "").trim(),
    url: r.redirect_url ?? "",
    created: r.created ?? null,
    salary_min: r.salary_min ?? null,
    salary_max: r.salary_max ?? null,
  }));
}
