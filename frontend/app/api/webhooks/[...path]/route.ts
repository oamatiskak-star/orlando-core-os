import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ path: string[] }> }

async function handleWebhook(req: NextRequest, { params }: Params) {
  const { path } = await params
  const endpointPath = path.join('/')
  const supabase = await createClient()

  const { data: webhook } = await supabase
    .from('oc_webhooks')
    .select('id, secret, workflow_id, status, method')
    .eq('endpoint_path', endpointPath)
    .single()

  if (!webhook) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 })
  }

  if (webhook.status !== 'actief') {
    return NextResponse.json({ error: 'Webhook inactive' }, { status: 403 })
  }

  if (webhook.method !== req.method && webhook.method !== 'ANY') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  let payload: unknown = null
  try {
    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      payload = await req.text()
    }
  } catch {
    payload = null
  }

  const signature = req.headers.get('x-webhook-signature') ?? req.headers.get('x-hub-signature-256') ?? null

  await supabase.from('oc_webhooks').update({
    last_triggered_at: new Date().toISOString(),
    trigger_count: supabase.rpc('oc_increment_webhook_count' as never, { wh_id: webhook.id }) as unknown as number,
  }).eq('id', webhook.id)

  if (webhook.workflow_id) {
    await supabase.from('oc_workflow_runs').insert({
      workflow_id: webhook.workflow_id,
      status: 'running',
      trigger_source: 'webhook',
      input_data: { payload, path: endpointPath, method: req.method, signature },
      started_at: new Date().toISOString(),
    })

    await supabase.from('oc_workflows').update({
      last_run_at: new Date().toISOString(),
      last_run_status: 'running',
    }).eq('id', webhook.workflow_id)
  }

  return NextResponse.json({
    received: true,
    webhook_id: webhook.id,
    timestamp: new Date().toISOString(),
  })
}

export const GET = handleWebhook
export const POST = handleWebhook
export const PUT = handleWebhook
export const PATCH = handleWebhook
export const DELETE = handleWebhook
