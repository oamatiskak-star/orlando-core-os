import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 0
export const maxDuration = 60

const AGENT_PATHS: Record<string, string> = {
  atlas: '/agents/atlas/run',
  viral_analyst: '/agents/viral-analyst/run',
  channel_manager: '/agents/channel-managers/run',
  algorithm_strategist: '/agents/algorithm-strategist/run',
  retention_scientist: '/agents/retention-scientist/run',
  content_fund_manager: '/agents/content-fund-manager/run',
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ agent_key: string }> }) {
  const { agent_key } = await ctx.params
  const path = AGENT_PATHS[agent_key]
  if (!path) return NextResponse.json({ error: 'Unknown agent_key' }, { status: 400 })

  const baseUrl = process.env.EXECUTIVE_ENGINE_URL
  if (!baseUrl) {
    return NextResponse.json({
      error: 'EXECUTIVE_ENGINE_URL not configured',
      hint: 'Set EXECUTIVE_ENGINE_URL in Vercel env to https://<render-service>/ once deployed',
    }, { status: 503 })
  }

  try {
    const resp = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const json = await resp.json().catch(() => ({ error: 'Non-JSON response from engine' }))
    return NextResponse.json(json, { status: resp.status })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}
