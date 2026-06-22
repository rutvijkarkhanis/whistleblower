import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Portal-aware job importer (free, ToS-reasonable).
// Strategy: schema.org JobPosting JSON-LD first (embedded by LinkedIn, Indeed,
// Greenhouse, Lever, Ashby, and most ATS for search engines), then
// portal-specific selectors, then generic body text.
// ---------------------------------------------------------------------------

export interface ParsedJob {
  source: string; // human label of the portal
  url: string;
  company?: string;
  role_title?: string;
  location?: string;
  jd_text: string;
}

const PORTALS: { match: RegExp; label: string }[] = [
  { match: /linkedin\.com/i, label: "LinkedIn" },
  { match: /indeed\./i, label: "Indeed" },
  { match: /bayt\.com/i, label: "Bayt" },
  { match: /gulftalent\.com/i, label: "GulfTalent" },
  { match: /naukrigulf\.com/i, label: "Naukri Gulf" },
  { match: /(wellfound|angel)\.co/i, label: "Wellfound" },
  { match: /greenhouse\.io/i, label: "Greenhouse" },
  { match: /lever\.co/i, label: "Lever" },
  { match: /ashbyhq\.com/i, label: "Ashby" },
];

export function detectSource(url: string): string {
  const found = PORTALS.find((p) => p.match.test(url));
  if (found) return found.label;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg").remove();
  return cleanText($("body").text() || $.root().text());
}

function cleanText(text: string): string {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Pull schema.org JobPosting out of any number of <script type=ld+json> blocks.
function parseJsonLd($: cheerio.CheerioAPI): Partial<ParsedJob> | null {
  const blocks: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw) return;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      /* ignore malformed JSON-LD */
    }
  });

  // flatten arrays / @graph wrappers
  const flat: Record<string, unknown>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      flat.push(obj);
      if (Array.isArray(obj["@graph"])) (obj["@graph"] as unknown[]).forEach(visit);
    }
  };
  blocks.forEach(visit);

  const posting = flat.find((o) => {
    const t = o["@type"];
    return t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"));
  });
  if (!posting) return null;

  const org = posting.hiringOrganization as { name?: string } | string | undefined;
  const company = typeof org === "string" ? org : org?.name;

  const loc = posting.jobLocation as
    | { address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }
    | Array<{ address?: { addressLocality?: string; addressRegion?: string; addressCountry?: string } }>
    | undefined;
  const addr = (Array.isArray(loc) ? loc[0] : loc)?.address;
  const location = addr
    ? [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean).join(", ")
    : undefined;

  const description = typeof posting.description === "string" ? htmlToText(posting.description) : "";

  return {
    company: company || undefined,
    role_title: typeof posting.title === "string" ? posting.title : undefined,
    location: location || undefined,
    jd_text: description || undefined,
  };
}

// Light portal-specific selectors used when JSON-LD is absent.
function parseSelectors($: cheerio.CheerioAPI, source: string): Partial<ParsedJob> {
  const pick = (sel: string) => cleanText($(sel).first().text());
  let role_title = pick("h1");
  let company = "";
  let jd_text = "";

  if (source === "LinkedIn") {
    role_title = pick(".top-card-layout__title") || role_title;
    company = pick(".topcard__org-name-link") || pick(".top-card-layout__second-subline a");
    jd_text = pick(".show-more-less-html__markup") || pick(".description__text");
  } else if (source === "Indeed") {
    role_title = pick("h1.jobsearch-JobInfoHeader-title") || role_title;
    company = pick('[data-company-name="true"]') || pick(".jobsearch-CompanyInfoContainer a");
    jd_text = pick("#jobDescriptionText");
  } else {
    jd_text = pick("main") || pick("article");
  }

  return {
    role_title: role_title || undefined,
    company: company || undefined,
    jd_text: jd_text || undefined,
  };
}

export function parseJobPage(url: string, html: string): ParsedJob {
  const source = detectSource(url);
  const $ = cheerio.load(html);

  const ld = parseJsonLd($) ?? {};
  const sel = parseSelectors($, source);
  const generic = htmlToText(html);

  // Prefer the richest description we have.
  const jd_text =
    [ld.jd_text, sel.jd_text].find((t) => t && t.length > 200) || ld.jd_text || sel.jd_text || generic;

  return {
    source,
    url,
    company: ld.company || sel.company,
    role_title: ld.role_title || sel.role_title,
    location: ld.location,
    jd_text: cleanText(jd_text || ""),
  };
}

export async function fetchJobFromUrl(url: string): Promise<ParsedJob> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
  const html = await res.text();
  const parsed = parseJobPage(url, html);
  if (!parsed.jd_text || parsed.jd_text.length < 40) {
    throw new Error(
      `${parsed.source} returned no readable job text (login wall or JS-only page). Paste the JD text instead.`,
    );
  }
  return parsed;
}
