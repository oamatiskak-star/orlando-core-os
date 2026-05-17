import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const urgency         = searchParams.get('urgency')
  const action_required = searchParams.get('action_required') === 'true'
  const limit           = parseInt(searchParams.get('limit') ?? '100')

  let q = supabase
    .from('advocaat_mail_defense')
    .select('*')
    .order('risk_score', { ascending: false })
    .order('received_at', { ascending: false })
    .limit(limit)

  if (urgency)         q = q.eq('urgency', urgency)
  if (action_required) q = q.eq('action_required', true).eq('processed', false)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const LEGAL_KEYWORDS = [
    'curator', 'faillissement', 'dagvaarding', 'vonnis', 'ingebrekestelling',
    'sommatie', 'aansprakelijk', 'pauliana', 'boedel', 'schulden',
    'rechter', 'rechtbank', 'incasso', 'bestuursverbod', 'hoger beroep',
  ]

  const DEADLINE_PATTERNS = [
    /binnen (\d+) dag/i, /uiterlijk (\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /voor (\d{1,2} \w+ \d{4})/i, /deadline/i, /fatale termijn/i,
  ]

  const subject = (body.subject ?? '').toLowerCase()
  const text    = (body.body_text ?? '').toLowerCase()
  const combined = subject + ' ' + text

  const foundKeywords = LEGAL_KEYWORDS.filter(k => combined.includes(k))
  const isCurator       = combined.includes('curator')
  const isDagvaarding   = combined.includes('dagvaarding')
  const isIngebrekestelling = combined.includes('ingebrekestelling') || combined.includes('sommatie')

  let classification = 'neutraal'
  if (isCurator)           classification = 'curator_bericht'
  else if (isDagvaarding)  classification = 'dagvaarding'
  else if (isIngebrekestelling) classification = 'ingebrekestelling'
  else if (combined.includes('vonnis')) classification = 'vonnis'
  else if (combined.includes('incasso')) classification = 'incasso'
  else if (foundKeywords.length > 0) classification = 'juridisch_neutraal'

  let urgency = 'laag'
  if (isCurator || isDagvaarding) urgency = 'kritiek'
  else if (isIngebrekestelling || combined.includes('vonnis')) urgency = 'hoog'
  else if (foundKeywords.length >= 2) urgency = 'medium'

  const riskScore = Math.min(100,
    (isCurator ? 40 : 0) +
    (isDagvaarding ? 35 : 0) +
    (isIngebrekestelling ? 25 : 0) +
    (foundKeywords.length * 5)
  )

  let deadlineDetected: string | null = null
  let deadlineText: string | null = null
  for (const pattern of DEADLINE_PATTERNS) {
    const match = combined.match(pattern)
    if (match) {
      deadlineText = match[0]
      break
    }
  }

  const actionRequired = riskScore >= 25 || foundKeywords.length >= 2

  const { data, error } = await supabase.from('advocaat_mail_defense').insert({
    mail_message_id: body.message_id ?? null,
    from_address:    body.from_address ?? null,
    from_name:       body.from_name ?? null,
    subject:         body.subject ?? null,
    received_at:     body.received_at ?? new Date().toISOString(),
    body_text:       body.body_text ?? null,
    classification,
    urgency,
    risk_score: riskScore,
    deadline_detected: deadlineDetected,
    deadline_text: deadlineText,
    key_entities: { keywords: foundKeywords },
    action_required: actionRequired,
    action_description: actionRequired
      ? `Juridische mail gedetecteerd (${classification}). Raadpleeg Strategie Engine voor advies.`
      : null,
    ai_summary: foundKeywords.length > 0
      ? `Mail bevat juridische trefwoorden: ${foundKeywords.join(', ')}. Classificatie: ${classification}. Urgentie: ${urgency}.`
      : null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data, classification, urgency, risk_score: riskScore })
}
