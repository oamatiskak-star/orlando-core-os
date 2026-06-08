import { router } from '../router.js'
import { logRouter } from '../db.js'
import { hermesDb, extractJson } from './shared.js'

interface DispatchItem {
  id: string
  title: string
  payload: { source?: string; skill?: string; project?: string; raw_message?: string; agents?: string[] } | null
}

// Domain-skills die een ECHTE engine vereisen (router kan ze niet zelf uitvoeren).
// Voor die taken levert de executor een triage + needs_engine=true (delegatie),
// i.p.v. te doen alsof het domeinwerk is uitgevoerd.
const DOMAIN_SKILLS = new Set([
  'youtube_upload_pipeline', 'youtube_oauth_health', 'affiliate_account_setup',
  'pdf_quote_diagnostics', 'market_data_feed_check',
])

/** Voer één gedispatchte Hermes-taak uit: lokale triage/analyse → resultaat. */
async function executeItem(item: DispatchItem): Promise<'done' | 'failed'> {
  const p = item.payload ?? {}
  const skill = p.skill ?? 'analyse'
  const project = p.project ?? 'onbekend'
  const msg = p.raw_message ?? item.title
  const domain = DOMAIN_SKILLS.has(skill)
  try {
    const resp = await router.complete({
      tier: 'classification',
      localOnly: true,
      jsonMode: true,
      caller: `hermes-exec:${skill}`,
      maxTokens: 500,
      temperature: 0.1,
      system:
        `Je bent de Hermes-executor. Voer de skill "${skill}" uit voor project "${project}" als eerste-lijns triage. ` +
        (domain ? 'Dit vereist een domein-engine voor de daadwerkelijke actie; lever de triage + zet needs_engine=true. ' : '') +
        'Antwoord UITSLUITEND als JSON: {"findings":["..."],"recommendation":"...","needs_engine":true|false}.',
      messages: [{ role: 'user', content: `Taak: ${msg}\nLever de triage als JSON.` }],
    })
    const parsed = extractJson<{ findings?: string[]; recommendation?: string; needs_engine?: boolean }>(resp.text) ?? {
      findings: [],
      recommendation: resp.text.slice(0, 400),
      needs_engine: domain,
    }
    await hermesDb()
      .from('dispatch_queue')
      .update({
        status: 'done',
        result: {
          executor: 'hermes-exec',
          skill,
          project,
          provider: resp.provider,
          model: resp.model,
          findings: parsed.findings ?? [],
          recommendation: parsed.recommendation ?? '',
          needs_engine: parsed.needs_engine ?? domain,
        },
        heartbeat_at: new Date().toISOString(),
      })
      .eq('id', item.id)
    return 'done'
  } catch (e) {
    await hermesDb()
      .from('dispatch_queue')
      .update({ status: 'failed', result: { executor: 'hermes-exec', error: (e as Error).message } })
      .eq('id', item.id)
    return 'failed'
  }
}

let running = false
async function tick(): Promise<void> {
  if (running) return
  running = true
  try {
    const { data, error } = await hermesDb().rpc('exec_claim', { p_limit: 3 })
    if (error) return
    const items = (data ?? []) as DispatchItem[]
    for (const item of items) await executeItem(item)
    if (items.length > 0) {
      await logRouter('info', 'hermes_executor_batch', { executed: items.length })
    }
  } catch {
    /* transient — next tick */
  } finally {
    running = false
  }
}

let timer: ReturnType<typeof setInterval> | null = null
export function startExecutorPoller(): void {
  if (timer) return
  timer = setInterval(() => void tick(), 4000)
  void logRouter('info', 'hermes_executor_started', { interval_ms: 4000 })
}
