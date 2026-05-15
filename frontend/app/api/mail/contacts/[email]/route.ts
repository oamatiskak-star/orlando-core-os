import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ email: string }> }
) {
  const { email } = await params
  const decodedEmail = decodeURIComponent(email)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: contact, error: contactErr } = await supabase
    .from('mail_contacts')
    .select('*')
    .eq('email', decodedEmail)
    .single()

  if (contactErr && contactErr.code !== 'PGRST116') {
    return NextResponse.json({ error: contactErr.message }, { status: 500 })
  }

  if (!contact) {
    return NextResponse.json({ contact: null, interactions: [], openMails: 0 })
  }

  const [interactionsRes, openMailsRes] = await Promise.allSettled([
    supabase
      .from('mail_contact_interactions')
      .select('*')
      .eq('contact_id', contact.id)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('mail_messages')
      .select('id', { count: 'exact', head: true })
      .eq('from_email', decodedEmail)
      .eq('is_read', false),
  ])

  const interactions = interactionsRes.status === 'fulfilled' ? (interactionsRes.value.data ?? []) : []
  const openMails = openMailsRes.status === 'fulfilled' ? (openMailsRes.value.count ?? 0) : 0

  return NextResponse.json({ contact, interactions, openMails })
}
