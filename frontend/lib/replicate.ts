// ─────────────────────────────────────────────────────────────────────────────
// Replicate API helper voor renderer cron routes.
// Native fetch — geen replicate-js dep.
// Auth: REPLICATE_API_TOKEN env var.
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.replicate.com/v1'

function token(): string {
  const t = process.env.REPLICATE_API_TOKEN
  if (!t) throw new Error('REPLICATE_API_TOKEN is required')
  return t
}

export type PredictionStatus = 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled'

export interface Prediction {
  id:       string
  status:   PredictionStatus
  output:   string | string[] | null
  error:    string | null
  model:    string | null
  created_at: string
  started_at: string | null
  completed_at: string | null
  logs?: string | null
}

// Start een prediction op een specifiek model (vorm 'owner/name' of 'owner/name:version').
// minimax/video-01 input: { prompt: string, prompt_optimizer?: boolean }.
export async function createPrediction(
  model: string,
  input: Record<string, unknown>,
): Promise<Prediction> {
  const isVersioned = model.includes(':')
  const url = isVersioned
    ? `${API_BASE}/predictions`
    : `${API_BASE}/models/${model}/predictions`
  const body = isVersioned ? { version: model.split(':')[1], input } : { input }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Token ${token()}`,
      'content-type': 'application/json',
      prefer: 'wait=0', // direct return, async
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Replicate createPrediction ${res.status}: ${txt.slice(0, 300)}`)
  }
  return (await res.json()) as Prediction
}

export async function getPrediction(predictionId: string): Promise<Prediction> {
  const res = await fetch(`${API_BASE}/predictions/${predictionId}`, {
    headers: { authorization: `Token ${token()}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Replicate getPrediction ${res.status}: ${txt.slice(0, 300)}`)
  }
  return (await res.json()) as Prediction
}

// Output van video models is meestal een single URL of [URL]. Normaliseer naar één string.
export function firstOutputUrl(p: Prediction): string | null {
  if (!p.output) return null
  if (Array.isArray(p.output)) return p.output[0] ?? null
  if (typeof p.output === 'string') return p.output
  return null
}
