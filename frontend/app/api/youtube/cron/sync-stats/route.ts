import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = process.env.NEXT_PUBLIC_APP_URL
  const res = await fetch(`${base}/api/youtube/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })

  const data = await res.json().catch(() => ({}))
  return NextResponse.json({ ok: res.ok, ...data })
}
