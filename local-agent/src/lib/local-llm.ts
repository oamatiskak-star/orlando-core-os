import axios from 'axios'

/**
 * Gedeeld lokaal-LLM-transport (LM Studio primair → Ollama fallback), identiek
 * aan ai.ts/scene-planner. Retourneert een geparset JSON-object. Geen cloud,
 * geen API-key. Voor concept-scoring in de Visual/Thumbnail/Music-engines.
 */

const USE_LM_STUDIO   = process.env.USE_LM_STUDIO !== 'false'
const LM_STUDIO_URL   = process.env.LM_STUDIO_URL   || 'http://localhost:1234'
const LM_STUDIO_MODEL = process.env.LM_STUDIO_MODEL || 'default'
const OLLAMA_URL      = process.env.OLLAMA_URL      || 'http://localhost:11434'
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL    || 'llama3.2'

async function callLMStudio(prompt: string): Promise<string> {
  const res = await axios.post(`${LM_STUDIO_URL}/v1/chat/completions`, {
    model: LM_STUDIO_MODEL, messages: [{ role: 'user', content: prompt }], temperature: 0.5, max_tokens: 1024,
  }, { timeout: 120_000 })
  return res.data.choices[0].message.content as string
}
async function callOllama(prompt: string): Promise<string> {
  const res = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL, prompt, stream: false, format: 'json', options: { temperature: 0.4, num_predict: 2048 },
  }, { timeout: 180_000 })
  return res.data.response as string
}

function extractJson(raw: string): any {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
  const m = cleaned.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('local-llm: geen JSON in respons')
  return JSON.parse(m[0])
}

/** Vraag het lokale model om JSON; fallback naar de andere backend; één retry. */
export async function localLlmJson(prompt: string): Promise<any> {
  let raw: string
  try { raw = USE_LM_STUDIO ? await callLMStudio(prompt) : await callOllama(prompt) }
  catch { raw = USE_LM_STUDIO ? await callOllama(prompt) : await callLMStudio(prompt) }
  try { return extractJson(raw) }
  catch {
    const retry = USE_LM_STUDIO ? await callOllama(prompt) : await callLMStudio(prompt)
    return extractJson(retry)
  }
}

export function clampScore(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? Math.min(100, Math.max(0, Math.round(v))) : 0
}
