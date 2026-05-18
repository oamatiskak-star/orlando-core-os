import { createAnthropic } from '@ai-sdk/anthropic'

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Modellen
export const claude = {
  opus:   anthropic('claude-opus-4-7'),
  sonnet: anthropic('claude-sonnet-4-6'),
  haiku:  anthropic('claude-haiku-4-5-20251001'),
}

// Standaard model voor het platform
export const defaultModel = claude.sonnet

export { anthropic }
