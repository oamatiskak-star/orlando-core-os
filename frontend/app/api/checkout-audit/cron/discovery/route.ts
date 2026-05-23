import { NextRequest, NextResponse } from 'next/server'

export const revalidate = 0
export const maxDuration = 60

const AUDITOR_URL = process.env.CHECKOUT_AUDITOR_URL ?? 'https://orlando-checkout-auditor.onrender.com'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(`${AUDITOR_URL}/discover`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.CHECKOUT_AUDITOR_TRIGGER_SECRET ?? ''}`,
      },
      body: JSON.stringify({}),
    })
    const body = await response.json().catch(() => ({}))
    return NextResponse.json({ forwarded: true, status: response.status, body })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    )
  }
}
