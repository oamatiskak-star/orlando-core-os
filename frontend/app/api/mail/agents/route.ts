import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('mail_agents').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('mail_agents')
    .insert({
      name:                   body.name,
      agent_type:             body.agent_type,
      model:                  body.model ?? 'claude-sonnet-4-6',
      description:            body.description ?? null,
      system_prompt_override: body.system_prompt_override ?? null,
      enabled:                body.enabled ?? true,
      config:                 body.config ?? {},
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
