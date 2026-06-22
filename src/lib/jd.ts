import { generateJson } from "./llm";
import { detectSource, fetchJobFromUrl } from "./portals";
import { SYSTEM_PREAMBLE } from "./profile";
import { serviceClient } from "./supabase";
import type { FitBreakdown, Job } from "./types";

// ---------------------------------------------------------------------------
// Module 1 — JD Intelligence
// (URL fetching + portal parsing now lives in src/lib/portals.ts)
// ---------------------------------------------------------------------------

export interface JdAnalysis {
  company: string;
  role_title: string;
  seniority: string;
  must_haves: string[];
  nice_to_haves: string[];
  red_flags: string[];
  keywords: string[];
  dubai_signals: string[];
  fit_score: number;
  fit_breakdown: FitBreakdown;
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    company: { type: "string", description: "Hiring company name, or 'Unknown' if absent" },
    role_title: { type: "string" },
    seniority: { type: "string", description: "e.g. Mid, Senior, Executive, C-suite" },
    must_haves: { type: "array", items: { type: "string" } },
    nice_to_haves: { type: "array", items: { type: "string" } },
    red_flags: {
      type: "array",
      items: { type: "string" },
      description: "Warning signs for the candidate (vague scope, unrealistic asks, low pay signals, churn risk)",
    },
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "ATS keywords to mirror in the application",
    },
    dubai_signals: {
      type: "array",
      items: { type: "string" },
      description: "Dubai/GCC relevance signals found in the JD (location, visa sponsorship, GCC expansion, regional mandate)",
    },
    fit_score: { type: "integer", description: "Overall fit 0-100" },
    fit_breakdown: {
      type: "object",
      additionalProperties: false,
      properties: {
        gtm: { type: "integer", description: "0-100 fit on GTM" },
        founders_office: { type: "integer", description: "0-100 fit on Founder's Office / Chief of Staff" },
        dubai_gcc: { type: "integer", description: "0-100 fit on Dubai/GCC relevance" },
        industry: { type: "integer", description: "0-100 fit on industry (building materials, climate, B2B)" },
        rationale: { type: "string", description: "2-3 sentence rationale grounded in Rutvij's actual achievements" },
      },
      required: ["gtm", "founders_office", "dubai_gcc", "industry", "rationale"],
    },
  },
  required: [
    "company",
    "role_title",
    "seniority",
    "must_haves",
    "nice_to_haves",
    "red_flags",
    "keywords",
    "dubai_signals",
    "fit_score",
    "fit_breakdown",
  ],
} as const;

export async function analyzeJd(jdText: string): Promise<JdAnalysis> {
  const system = `${SYSTEM_PREAMBLE}

TASK: Analyze the job description below. Extract structured intelligence and score how well Rutvij fits.

Scoring guidance:
- Score each dimension 0-100 honestly. Do not inflate.
- The overall fit_score should weight: Founder's Office/Chief of Staff alignment, GTM relevance, Dubai/GCC relevance, and industry overlap.
- ALWAYS extract Dubai/GCC relevance signals — if the role is not Dubai/GCC relevant, say so and reflect it in the dubai_gcc dimension.
- The rationale must reference his real achievements.`;

  return generateJson<JdAnalysis>({
    system,
    user: `JOB DESCRIPTION:\n\n${jdText}`,
    schema: ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
    maxTokens: 2000,
  });
}

// Fetch (if url) -> analyze -> store. Shared by single + bulk import.
export async function importJob(input: { jd_text?: string; jd_url?: string }): Promise<Job> {
  let jdText = input.jd_text;
  let source: string | undefined;
  let location: string | undefined;
  let companyHint: string | undefined;
  let titleHint: string | undefined;

  if (!jdText && input.jd_url) {
    const parsed = await fetchJobFromUrl(input.jd_url);
    jdText = parsed.jd_text;
    source = parsed.source;
    location = parsed.location;
    companyHint = parsed.company;
    titleHint = parsed.role_title;
  }
  if (!jdText || jdText.trim().length < 40) {
    throw new Error("Provide jd_text or a scrapeable jd_url");
  }

  const analysis = await analyzeJd(jdText);
  const db = serviceClient();
  const { data, error } = await db
    .from("jobs")
    .insert({
      company: analysis.company || companyHint || null,
      role_title: analysis.role_title || titleHint || null,
      seniority: analysis.seniority,
      jd_text: jdText,
      jd_url: input.jd_url ?? null,
      source: source ?? (input.jd_url ? detectSource(input.jd_url) : "manual"),
      location: location ?? null,
      fit_score: analysis.fit_score,
      fit_breakdown_json: analysis.fit_breakdown,
      keywords: analysis.keywords,
      must_haves: analysis.must_haves,
      nice_to_haves: analysis.nice_to_haves,
      red_flags: analysis.red_flags,
      dubai_signals: analysis.dubai_signals,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Job;
}
