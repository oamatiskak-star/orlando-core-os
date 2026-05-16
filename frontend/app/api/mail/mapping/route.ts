import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RuleBody = {
  name: string
  priority?: number
  enabled?: boolean
  match_from_domain?: string
  match_from_email?: string
  match_subject_contains?: string
  match_to_account?: string
  set_company?: string
  set_category?: string
  set_priority?: string
  set_is_invoice?: boolean
  set_is_legal_notice?: boolean
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('mail_routing_rules')
    .select('*')
    .order('priority', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rules: data })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as RuleBody

  const { data, error } = await supabase
    .from('mail_routing_rules')
    .insert({
      name:                   body.name,
      priority:               body.priority ?? 50,
      enabled:                body.enabled ?? true,
      match_from_domain:      body.match_from_domain || null,
      match_from_email:       body.match_from_email || null,
      match_subject_contains: body.match_subject_contains || null,
      match_to_account:       body.match_to_account || null,
      set_company:            body.set_company || null,
      set_category:           body.set_category || null,
      set_priority:           body.set_priority || null,
      set_is_invoice:         body.set_is_invoice ?? null,
      set_is_legal_notice:    body.set_is_legal_notice ?? null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}
