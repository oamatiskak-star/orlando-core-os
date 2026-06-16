import axios from 'axios'

/**
 * Cloud-LLM (OpenAI) voor script + scene-planning. Betrouwbaarder dan de lokale modellen
 * (gegarandeerde JSON, geen RAM/timeout-limieten) — de €60k-pivot vereist consistente output.
 * Gegate op LLM_PROVIDER=openai + OPENAI_API_KEY. Callers vallen bij fout terug op lokaal.
 */
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'

export function openaiAvailable(): boolean {
  return process.env.LLM_PROVIDER === 'openai' && !!process.env.OPENAI_API_KEY
}

export async function openaiChat(prompt: string, opts?: { json?: boolean; model?: string; maxTokens?: number }): Promise<string> {
  const model = opts?.model || process.env.OPENAI_LLM_MODEL || 'gpt-4o-mini'
  const body: Record<string, unknown> = {
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: opts?.maxTokens ?? 4096,
  }
  // json_object vereist dat 'json' in de prompt staat (OpenAI-eis) — onze prompts vragen al JSON.
  if (opts?.json && /json/i.test(prompt)) body.response_format = { type: 'json_object' }
  const res = await axios.post(OPENAI_URL, body, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    timeout: 120_000,
  })
  return (res.data?.choices?.[0]?.message?.content ?? '') as string
}
