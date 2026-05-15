import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mailEngineUrl = process.env.MAIL_ENGINE_URL ?? 'http://localhost:3003'

  try {
    const res = await fetch(`${mailEngineUrl}/sync`, { method: 'POST' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Mail engine sync failed' }, { status: 502 })
    }
    const data = await res.json() as unknown
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 503 })
  }
}
