import { createGateway } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'

const useGateway = !!(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY)

const gw = useGateway
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : null

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export const claude = {
  opus:   useGateway ? gw!('anthropic/claude-opus-4-7')           : anthropic('claude-opus-4-7'),
  sonnet: useGateway ? gw!('anthropic/claude-sonnet-4-6')         : anthropic('claude-sonnet-4-6'),
  haiku:  useGateway ? gw!('anthropic/claude-haiku-4-5-20251001') : anthropic('claude-haiku-4-5-20251001'),
}

export const openai = useGateway
  ? { gpt4o: gw!('openai/gpt-4o'), gpt4: gw!('openai/gpt-4') }
  : null

export const defaultModel = useGateway
  ? gw!('openai/gpt-4')
  : anthropic('claude-sonnet-4-6')

export { anthropic }
