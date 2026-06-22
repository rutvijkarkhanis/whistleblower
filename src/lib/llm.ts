import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Provider-agnostic LLM layer.
// Pick the provider with LLM_PROVIDER = "gemini" (default, free) | "anthropic" | "groq".
// Each provider's model is overridable via env.
// ---------------------------------------------------------------------------

type Provider = "gemini" | "anthropic" | "groq";

export const PROVIDER: Provider = (process.env.LLM_PROVIDER as Provider) || "gemini";

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (required for LLM_PROVIDER=${PROVIDER}).`);
  return v;
}

// --- Anthropic ---------------------------------------------------------------
let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: requireEnv("ANTHROPIC_API_KEY") });
  return anthropicClient;
}
async function anthropicGenerate(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await anthropic().messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// --- Gemini (REST, free tier) ------------------------------------------------
async function geminiGenerate(system: string, user: string, maxTokens: number, json: boolean): Promise<string> {
  const key = requireEnv("GEMINI_API_KEY");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: "application/json" } : {}),
      },
    }),
  });
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no text (possibly blocked or empty).");
  return text;
}

// --- Groq (OpenAI-compatible, free tier) -------------------------------------
async function groqGenerate(system: string, user: string, maxTokens: number, json: boolean): Promise<string> {
  const key = requireEnv("GROQ_API_KEY");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      ...(json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Groq error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "";
}

async function dispatch(system: string, user: string, maxTokens: number, json: boolean): Promise<string> {
  if (PROVIDER === "anthropic") return anthropicGenerate(system, user, maxTokens);
  if (PROVIDER === "groq") return groqGenerate(system, user, maxTokens, json);
  return geminiGenerate(system, user, maxTokens, json);
}

// --- Public API --------------------------------------------------------------
export async function generateText(opts: { system: string; user: string; maxTokens?: number }): Promise<string> {
  const text = await dispatch(opts.system, opts.user, opts.maxTokens ?? 4000, false);
  return text.trim();
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Model did not return JSON");
  return body.slice(start, end + 1);
}

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

  const text = await dispatch(system, opts.user, opts.maxTokens ?? 4000, true);
  return JSON.parse(extractJson(text)) as T;
}
