import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  const { dossierId } = await params
  const { status } = await req.json()

  const valid = ['open', 'in_behandeling', 'gesloten', 'afgewezen']
  if (!valid.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('mail_legal_dossiers')
    .update({ status })
    .eq('id', dossierId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
