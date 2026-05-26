import Anthropic from '@anthropic-ai/sdk'
import { env } from './secrets'

export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY })

const PRICE_PER_MTOK_IN: Record<string, number> = {
  'claude-opus-4-7': 15.0,
  'claude-sonnet-4-6': 3.0,
  'claude-haiku-4-5': 1.0,
}
const PRICE_PER_MTOK_OUT: Record<string, number> = {
  'claude-opus-4-7': 75.0,
  'claude-sonnet-4-6': 15.0,
  'claude-haiku-4-5': 5.0,
}

export function estimateCostUsd(model: string, tokensIn: number, tokensOut: number): number {
  const inPrice = PRICE_PER_MTOK_IN[model] ?? 3.0
  const outPrice = PRICE_PER_MTOK_OUT[model] ?? 15.0
  return (tokensIn * inPrice + tokensOut * outPrice) / 1_000_000
}

/**
 * Extracts the first balanced JSON object found in text. Handles:
 *   - markdown code fences (```json ... ```)
 *   - prose before/after the JSON
 *   - nested braces in strings
 * Throws if no parseable JSON found.
 */
export function extractJson<T = unknown>(text: string): T {
  // Strip markdown fences first
  const stripped = text
    .replace(/^[\s\S]*?```(?:json)?\s*/i, '')
    .replace(/\s*```[\s\S]*$/i, '')

  // Find the outermost balanced JSON object
  const start = stripped.indexOf('{')
  if (start < 0) throw new Error('No JSON object found in response')

  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < stripped.length; i++) {
    const c = stripped[i]
    if (escape) { escape = false; continue }
    if (c === '\\' && inString) { escape = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') depth++
    else if (c === '}') {
      depth--
      if (depth === 0) {
        const candidate = stripped.slice(start, i + 1)
        return JSON.parse(candidate) as T
      }
    }
  }
  throw new Error('Unbalanced JSON in response')
}
