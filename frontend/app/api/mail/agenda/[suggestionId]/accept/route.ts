import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ suggestionId: string }> }
) {
  const { suggestionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('mail_agenda_suggestions')
    .update({ status: 'accepted' })
    .eq('id', suggestionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'accepted' })
}
