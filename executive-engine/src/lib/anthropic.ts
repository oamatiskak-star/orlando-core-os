import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY is required')
}

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

export function extractJson<T = unknown>(text: string): T {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in response')
  return JSON.parse(match[0]) as T
}
