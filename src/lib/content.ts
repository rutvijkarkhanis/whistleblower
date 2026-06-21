import { generateText } from "./anthropic";
import { SYSTEM_PREAMBLE } from "./profile";
import type { ContentType, Job, Tone } from "./types";

// ---------------------------------------------------------------------------
// Module 2 — Content Generation
// ---------------------------------------------------------------------------

const TONE_GUIDE: Record<Tone, string> = {
  executive: "Polished, board-room confident, concise. Senior peer-to-peer register.",
  "founder-to-founder": "Warm but sharp, builder-to-builder. Reference the grind of building from zero.",
  direct: "Punchy, no preamble, gets to the point fast. Respect the reader's time.",
};

function jobContext(job: Job): string {
  const fit = job.fit_breakdown_json;
  return [
    `COMPANY: ${job.company ?? "Unknown"}`,
    `ROLE: ${job.role_title ?? "Unknown"} (${job.seniority ?? "n/a"})`,
    job.keywords?.length ? `ATS KEYWORDS: ${job.keywords.join(", ")}` : "",
    job.must_haves?.length ? `MUST-HAVES: ${job.must_haves.join("; ")}` : "",
    job.dubai_signals?.length ? `DUBAI/GCC SIGNALS: ${job.dubai_signals.join("; ")}` : "",
    fit ? `FIT RATIONALE: ${fit.rationale}` : "",
    "",
    "JOB DESCRIPTION:",
    job.jd_text ?? "(not provided)",
  ]
    .filter(Boolean)
    .join("\n");
}

const PROMPTS: Record<ContentType, { instruction: string; maxTokens: number }> = {
  cover_letter: {
    instruction:
      "Write a 3-paragraph cover letter. Para 1: a specific hook tied to the company/role. Para 2: two or three of Rutvij's most relevant, quantified achievements mapped to the must-haves. Para 3: Dubai context + a confident close. No salutation clichés, no 'I am writing to apply'.",
    maxTokens: 1200,
  },
  linkedin_dm_hm: {
    instruction:
      "Write a LinkedIn DM to the hiring manager. Under 200 words. Open with a specific hook about their company or the role, not about Rutvij. Lead with one sharp, relevant proof point. End with a low-friction ask. No links, no fluff.",
    maxTokens: 600,
  },
  linkedin_dm_recruiter: {
    instruction:
      "Write a LinkedIn DM to the recruiter. Shorter than the hiring-manager DM and from a different angle: make their job easy — state the role, the 2 strongest matches, and Dubai availability/visa-readiness in a crisp way. Under 130 words.",
    maxTokens: 500,
  },
  cold_email_1: {
    instruction:
      "Write cold email #1 (intro). Subject line + body. Specific, relevant hook; one proof point; clear single ask for a short call. Keep under 130 words. Format as 'Subject: ...' then a blank line then the body.",
    maxTokens: 600,
  },
  cold_email_2: {
    instruction:
      "Write cold email #2, a follow-up sent on day 4. It must reference the first email lightly, add ONE new angle or proof point, and stay under 90 words. Format as 'Subject: ...' then a blank line then the body.",
    maxTokens: 500,
  },
  cold_email_3: {
    instruction:
      "Write cold email #3, the breakup email sent on day 10. Gracious, no guilt-trip, leave the door open, under 70 words. Format as 'Subject: ...' then a blank line then the body.",
    maxTokens: 400,
  },
  whatsapp: {
    instruction:
      "Write a WhatsApp message. Punchy, 3-4 short lines, conversational but professional. Specific hook + one proof point + soft ask. No formal salutation.",
    maxTokens: 400,
  },
  interview_qa: {
    instruction:
      "Generate the 5 most likely interview questions for THIS role, and for each a tight STAR answer (Situation, Task, Action, Result) built from Rutvij's actual resume bullets. Use his real numbers. Format each as 'Q1: ...' then 'STAR:' with labelled S/T/A/R lines.",
    maxTokens: 3000,
  },
  salary_script: {
    instruction:
      "Write a salary negotiation script calibrated to the Dubai market for this role and seniority. Cover: anchoring the range in AED (annual), how to handle the 'what's your expectation' question, justifying with his track record, and negotiating non-cash levers (visa, relocation, bonus, equity). Give exact phrasing he can say out loud.",
    maxTokens: 1800,
  },
};

export async function generateContent(job: Job, type: ContentType, tone: Tone): Promise<string> {
  const spec = PROMPTS[type];
  const system = `${SYSTEM_PREAMBLE}

TONE FOR THIS OUTPUT: ${tone} — ${TONE_GUIDE[tone]}`;

  const user = `${jobContext(job)}

---
TASK: ${spec.instruction}

Output ONLY the requested content. No meta commentary, no "here is...".`;

  return generateText({ system, user, maxTokens: spec.maxTokens });
}
