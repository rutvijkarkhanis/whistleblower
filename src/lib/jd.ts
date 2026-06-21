import * as cheerio from "cheerio";
import { generateJson } from "./anthropic";
import { SYSTEM_PREAMBLE } from "./profile";
import type { FitBreakdown } from "./types";

// ---------------------------------------------------------------------------
// Module 1 — JD Intelligence
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

// Scrape a JD page to plain text with cheerio.
export async function scrapeJdUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch JD URL (${res.status})`);
  const html = await res.text();
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, header, footer, nav").remove();
  const text = $("main").text() || $("body").text();
  return text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
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
