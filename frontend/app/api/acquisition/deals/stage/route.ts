import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STAGES = ['radar', 'analyse', 'due_diligence', 'bod', 'gewonnen']
const VALID = [...STAGES, 'verloren']

// Deal één stap door de pijplijn bewegen of afwijzen.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const id = typeof body.id === 'string' ? body.id : null
  const stage = typeof body.stage === 'string' ? body.stage : null
  if (!id || !stage || !VALID.includes(stage)) {
    return NextResponse.json({ error: 'id + geldige stage vereist' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('acq_deals').update({ pipeline_stage: stage }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
