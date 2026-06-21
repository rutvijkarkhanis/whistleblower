export type Stage = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export type Tone = "executive" | "founder-to-founder" | "direct";

export const CONTENT_TYPES = [
  "cover_letter",
  "linkedin_dm_hm",
  "linkedin_dm_recruiter",
  "cold_email_1",
  "cold_email_2",
  "cold_email_3",
  "whatsapp",
  "interview_qa",
  "salary_script",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_LABELS: Record<ContentType, string> = {
  cover_letter: "Cover Letter",
  linkedin_dm_hm: "LinkedIn DM — Hiring Manager",
  linkedin_dm_recruiter: "LinkedIn DM — Recruiter",
  cold_email_1: "Cold Email 1 — Intro",
  cold_email_2: "Cold Email 2 — Follow-up (day 4)",
  cold_email_3: "Cold Email 3 — Breakup (day 10)",
  whatsapp: "WhatsApp Message",
  interview_qa: "Interview Q&A (STAR)",
  salary_script: "Salary Negotiation Script",
};

export interface FitBreakdown {
  gtm: number;
  founders_office: number;
  dubai_gcc: number;
  industry: number;
  rationale: string;
}

export interface Job {
  id: string;
  company: string | null;
  role_title: string | null;
  seniority: string | null;
  jd_text: string | null;
  jd_url: string | null;
  fit_score: number | null;
  fit_breakdown_json: FitBreakdown | null;
  keywords: string[] | null;
  must_haves: string[] | null;
  nice_to_haves: string[] | null;
  red_flags: string[] | null;
  dubai_signals: string[] | null;
  stage: Stage;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GeneratedContent {
  id: string;
  job_id: string;
  type: ContentType;
  content: string | null;
  tone: Tone | null;
  version: number;
  edited: boolean;
  created_at: string;
}
