import { NextRequest, NextResponse } from 'next/server'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const MODEL = 'claude-opus-4-8'
const MAX_TOOL_ROUNDS = 6

/**
 * Hermes commando-set.
 *
 * Lees-commando's geven Hermes zicht op de echte systeemtoestand (uploads,
 * problemen, projecten). Actie-commando's laten hem operationele problemen
 * oplossen. Alles wat productie-onveilig is (deploys, merges, migraties,
 * Stripe, prijzen, data verwijderen) zit hier BEWUST niet in — dat blijft
 * mens-bevestigd (default-deny, conform Hermes Watchdog masterplan).
 */
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_uploads',
    description:
      'Haal de actuele upload-status op uit de media-fabriek (YouTube upload-queue + media-holding uploads). Gebruik dit zodra Orlando naar uploads, video\'s, publicaties of de upload-pipeline vraagt.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description:
            'Optioneel filter op status (bv. queued, uploading, processing, verified_live, failed, manual_review_required). Leeg = alle recente.',
        },
        limit: { type: 'integer', description: 'Max aantal rijen (default 15).' },
      },
    },
  },
  {
    name: 'get_upload_problems',
    description:
      'Haal de uploads op die VASTLOPEN of GEFAALD zijn (queue-status failed/manual_review_required + youtube_upload_failures + gefaalde media-holding uploads). Gebruik dit als Orlando vraagt wat er mis is met uploads.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_open_problems',
    description:
      'Haal alle open problemen op: niet-opgeloste proactive alerts + recente error/fatal log-events. Gebruik dit als Orlando vraagt "wat zijn de problemen" of "los de problemen op".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_projects',
    description: 'Haal de actieve build-projecten en hun status op.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_system_overview',
    description:
      'Geef een snelle telling van de hele operatie: uploads in wachtrij, gefaalde uploads, open alerts en actieve projecten. Gebruik dit voor "hoe staat het ervoor".',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'retry_upload',
    description:
      'Zet een gefaalde of vastgelopen upload opnieuw in de wachtrij zodat de pipeline het opnieuw probeert. Alleen toegestaan voor uploads met status failed of manual_review_required.',
    input_schema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'De id van de youtube_upload_queue-rij.' },
      },
      required: ['queue_id'],
    },
  },
  {
    name: 'resolve_alert',
    description:
      'Markeer een proactive alert als opgelost met een korte notitie over de genomen actie.',
    input_schema: {
      type: 'object',
      properties: {
        alert_id: { type: 'string', description: 'De id van de alert.' },
        note: { type: 'string', description: 'Korte notitie: wat is er gedaan.' },
      },
      required: ['alert_id', 'note'],
    },
  },
  {
    name: 'remember',
    description:
      'Sla iets op in het lange-termijngeheugen van Hermes zodat het bij volgende gesprekken meegenomen wordt.',
    input_schema: {
      type: 'object',
      properties: {
        item: { type: 'string', description: 'Wat onthouden moet worden.' },
      },
      required: ['item'],
    },
  },
]

type ToolResult = { ok: boolean; data?: unknown; error?: string }

async function runTool(
  db: SupabaseClient,
  companyId: string,
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  try {
    switch (name) {
      case 'get_uploads': {
        const limit = typeof input.limit === 'number' ? Math.min(input.limit, 50) : 15
        let q = db
          .from('youtube_upload_queue')
          .select(
            'id, status, title, retry_count, max_retries, last_error, youtube_url, scheduled_publish_at, upload_finished_at, updated_at, youtube_channels(name)'
          )
          .order('updated_at', { ascending: false })
          .limit(limit)
        if (typeof input.status === 'string' && input.status.trim()) {
          q = q.eq('status', input.status.trim())
        }
        const { data: queue, error: qErr } = await q
        if (qErr) return { ok: false, error: qErr.message }

        const { data: holding } = await db
          .from('media_holding_uploads')
          .select('id, platform, status, platform_video_id, error, uploaded_at, updated_at')
          .order('updated_at', { ascending: false })
          .limit(limit)

        return { ok: true, data: { youtube_queue: queue ?? [], media_holding: holding ?? [] } }
      }

      case 'get_upload_problems': {
        const { data: stuck } = await db
          .from('youtube_upload_queue')
          .select('id, status, title, retry_count, max_retries, last_error, updated_at, youtube_channels(name)')
          .in('status', ['failed', 'manual_review_required', 'retrying'])
          .order('updated_at', { ascending: false })
          .limit(25)

        const { data: failures } = await db
          .from('youtube_upload_failures')
          .select('id, queue_id, failure_type, failure_detail, recovery_attempted, recovery_success, created_at')
          .order('created_at', { ascending: false })
          .limit(25)

        const { data: holdingFailed } = await db
          .from('media_holding_uploads')
          .select('id, platform, status, error, updated_at')
          .eq('status', 'failed')
          .order('updated_at', { ascending: false })
          .limit(25)

        return {
          ok: true,
          data: {
            stuck_or_failed_queue: stuck ?? [],
            failure_log: failures ?? [],
            failed_media_holding: holdingFailed ?? [],
          },
        }
      }

      case 'get_open_problems': {
        const { data: alerts } = await db
          .schema('hermes')
          .from('proactive_alerts')
          .select('id, alert_type, severity, description, affected_entity, detected_at')
          .eq('company_id', companyId)
          .is('resolved_at', null)
          .order('detected_at', { ascending: false })
          .limit(20)

        const { data: errors } = await db
          .schema('hermes')
          .from('logs')
          .select('level, event, message, created_at')
          .in('level', ['error', 'fatal'])
          .order('created_at', { ascending: false })
          .limit(15)

        return { ok: true, data: { open_alerts: alerts ?? [], recent_errors: errors ?? [] } }
      }

      case 'get_projects': {
        const { data, error } = await db
          .from('build_projects')
          .select('id, name, status, updated_at')
          .eq('company_id', companyId)
          .order('updated_at', { ascending: false })
          .limit(25)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: data ?? [] }
      }

      case 'get_system_overview': {
        const queued = await db
          .from('youtube_upload_queue')
          .select('id', { count: 'exact', head: true })
          .in('status', ['queued', 'preparing', 'normalizing', 'uploading', 'processing', 'verifying'])
        const failedUploads = await db
          .from('youtube_upload_queue')
          .select('id', { count: 'exact', head: true })
          .in('status', ['failed', 'manual_review_required'])
        const openAlerts = await db
          .schema('hermes')
          .from('proactive_alerts')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .is('resolved_at', null)
        const activeProjects = await db
          .from('build_projects')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', companyId)

        return {
          ok: true,
          data: {
            uploads_in_progress: queued.count ?? 0,
            uploads_failed: failedUploads.count ?? 0,
            open_alerts: openAlerts.count ?? 0,
            active_projects: activeProjects.count ?? 0,
          },
        }
      }

      case 'retry_upload': {
        const queueId = String(input.queue_id || '')
        if (!queueId) return { ok: false, error: 'queue_id ontbreekt' }

        const { data: row, error: rErr } = await db
          .from('youtube_upload_queue')
          .select('id, status, retry_count, max_retries')
          .eq('id', queueId)
          .maybeSingle()
        if (rErr) return { ok: false, error: rErr.message }
        if (!row) return { ok: false, error: 'upload niet gevonden' }
        if (!['failed', 'manual_review_required'].includes(row.status)) {
          return { ok: false, error: `upload heeft status "${row.status}" — alleen failed/manual_review_required mag opnieuw` }
        }

        const { error: uErr } = await db
          .from('youtube_upload_queue')
          .update({ status: 'queued', last_error: null, updated_at: new Date().toISOString() })
          .eq('id', queueId)
        if (uErr) return { ok: false, error: uErr.message }

        await db
          .from('youtube_upload_failures')
          .update({ recovery_attempted: true })
          .eq('queue_id', queueId)
          .eq('recovery_attempted', false)

        return { ok: true, data: { queue_id: queueId, new_status: 'queued' } }
      }

      case 'resolve_alert': {
        const alertId = String(input.alert_id || '')
        const note = String(input.note || 'opgelost via Hermes-chat')
        if (!alertId) return { ok: false, error: 'alert_id ontbreekt' }

        const { error } = await db
          .schema('hermes')
          .from('proactive_alerts')
          .update({ resolved_at: new Date().toISOString(), action_taken: note })
          .eq('id', alertId)
          .eq('company_id', companyId)
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { alert_id: alertId, resolved: true } }
      }

      case 'remember': {
        const item = String(input.item || '')
        if (!item) return { ok: false, error: 'item ontbreekt' }
        const { error } = await db
          .schema('hermes')
          .rpc('remember', { p_company_id: companyId, p_item: item })
        if (error) return { ok: false, error: error.message }
        return { ok: true, data: { remembered: item } }
      }

      default:
        return { ok: false, error: `onbekend commando: ${name}` }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'onbekende fout' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { company_id, message, conversation_history } = await request.json()

    if (!company_id || !message) {
      return NextResponse.json({ error: 'Missing company_id or message' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    )

    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', company_id)
      .maybeSingle()

    const systemPrompt = `Je bent Hermes, de AI CEO-assistent van ${company?.name || 'dit bedrijf'}.
Je helpt Orlando met operationele inzichten, strategisch advies én concrete acties.

JE HEBT COMMANDO'S (tools). Gebruik ze ALTIJD wanneer relevant — verzin nooit zelf cijfers of status:
- get_uploads / get_upload_problems → vragen over uploads, video's, publicaties
- get_open_problems → "wat zijn de problemen", "los problemen op"
- get_projects / get_system_overview → hoe staat het ervoor
- retry_upload → een gefaalde upload opnieuw starten
- resolve_alert → een alert sluiten na actie
- remember → iets onthouden voor later

WERKWIJZE:
- Vraagt Orlando naar uploads of problemen? Roep eerst het juiste lees-commando aan, geef dan een kort antwoord met de ECHTE data.
- Vraagt Orlando om iets op te lossen? Haal eerst de problemen op, voer dan de veilige actie uit (retry_upload / resolve_alert) en rapporteer wat je deed.
- Productie-onveilige acties (deploys, merges, migraties, prijzen, Stripe, data verwijderen) doe je NIET zelf — meld dat die mens-bevestiging vereisen.

STIJL:
- Antwoord altijd in het Nederlands.
- Kort en actionable. Noem concrete aantallen, titels en statussen uit de data.
- Geen lange uitleg.`

    const messages: Anthropic.MessageParam[] = (conversation_history || []).map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }))
    messages.push({ role: 'user', content: message })

    const commandsUsed: string[] = []
    let finalText = ''

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages,
      })

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text'
      )
      if (textBlocks.length) finalText = textBlocks.map(b => b.text).join('\n').trim()

      if (response.stop_reason !== 'tool_use' || toolUses.length === 0) break

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        commandsUsed.push(tu.name)
        const result = await runTool(
          supabase,
          company_id,
          tu.name,
          (tu.input as Record<string, unknown>) || {}
        )
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: JSON.stringify(result),
          is_error: !result.ok,
        })
      }
      messages.push({ role: 'user', content: toolResults })
    }

    if (!finalText) finalText = 'Ik kon geen antwoord genereren.'

    return NextResponse.json({ response: finalText, commands_used: commandsUsed })
  } catch (error) {
    console.error('Error in Hermes chat:', error)
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Details:', errorMsg)
    return NextResponse.json(
      { error: 'Failed to process message', details: errorMsg },
      { status: 500 }
    )
  }
}
