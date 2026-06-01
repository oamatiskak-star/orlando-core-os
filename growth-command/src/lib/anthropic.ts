import Anthropic from "@anthropic-ai/sdk";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export function hasAnthropic(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * Ask Claude for a strictly-shaped JSON object. Returns parsed JSON or null on failure.
 * The caller provides a system prompt and a user prompt; we force a JSON-only reply.
 */
export async function askJson<T>(system: string, user: string, maxTokens = 1500): Promise<T | null> {
  if (!hasAnthropic()) return null;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: system + "\n\nReturn ONLY valid minified JSON. No markdown, no prose.",
      messages: [{ role: "user", content: user }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return null;
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as T;
  } catch (err) {
    console.error("[anthropic] askJson failed:", (err as Error).message);
    return null;
  }
}
