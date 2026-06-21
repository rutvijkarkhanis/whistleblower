import Anthropic from "@anthropic-ai/sdk";

// Every AI call in this app uses claude-sonnet-4-6 (per CLAUDE.md).
export const MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY. Add it to .env.local.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// Plain text generation with the shared system preamble.
export async function generateText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

// Strip markdown fences / prose and pull the first balanced JSON object.
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Model did not return JSON");
  }
  return body.slice(start, end + 1);
}

// Structured JSON extraction. We instruct strict JSON in the prompt (the
// JSON Schema is included as the contract) and parse defensively, so this
// works across SDK/model versions without depending on a beta param.
export async function generateJson<T>(opts: {
  system: string;
  user: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const system = `${opts.system}

Respond with ONLY a single JSON object that conforms exactly to this JSON Schema. No prose, no markdown fences, no trailing text.

JSON Schema:
${JSON.stringify(opts.schema)}`;

  const res = await anthropic().messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4000,
    system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  return JSON.parse(extractJson(text)) as T;
}
