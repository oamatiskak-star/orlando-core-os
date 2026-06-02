import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { claude } from '@/lib/ai/client'
import {
  parseCommand,
  COMMAND_HELP,
  type CommandKind,
  type HostId,
  type ParsedCommand,
} from '@/lib/hermes/command-router'

export const runtime = 'nodejs'
export const maxDuration = 60

type AdminClient = ReturnType<typeof createAdminClient>

interface HermesAction {
  label: string
  detail?: string
}

interface HermesReply {
  reply: string
  /** Backward-compat alias — oude callers lazen { response }. */
  response: string
  intent: CommandKind
  understood: boolean
  actions: HermesAction[]
  suggestions: string[]
  data?: unknown
}

const SUGGESTIONS = COMMAND_HELP.map((c) => c.example)

function reply(partial: Omit<HermesReply, 'response'>): NextResponse {
  return NextResponse.json({ ...partial, response: partial.reply })
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function logAction(db: AdminClient, event: string, message: string, context: Record<string, unknown>) {
  try {
    await db.schema('hermes').from('logs').insert({
      level: 'info',
      event,
      message,
      context: { ...context, source: 'command-center' },
    })
  } catch {
    /* logboek is best-effort — nooit de respons laten falen */
  }
}

function ago(ts: string | null | undefined): string {
  if (!ts) return 'nooit gezien'
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (s < 60) return `${s}s geleden`
  if (s < 3600) return `${Math.floor(s / 60)}m geleden`
  if (s < 86400) return `${Math.floor(s / 3600)}u geleden`
  return `${Math.floor(s / 86400)}d geleden`
}

function hostLabel(h: HostId): string {
  return h === 'cli-l' ? 'CLI-L' : 'CLI-R'
}

// ── command handlers ───────────────────────────────────────────────────────────

async function handleResume(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  const hosts = (cmd.hosts.length ? cmd.hosts : ['cli-l', 'cli-r']) as HostId[]
  const rows = hosts.map((h) => ({
    title: `Hervat: ga verder met de huidige taak (${hostLabel(h)})`,
    workstream: 'resume',
    target_host: h,
    priority: 3,
    payload: { instruction: 'ga verder', requested_by: 'orlando', via: 'command-center', company_id: companyId },
  }))

  const { data, error } = await db.schema('hermes').from('dispatch_queue').insert(rows).select('id, title, target_host')
  if (error) {
    return {
      reply: `Kon de hervat-taken niet aanmaken. Geen data weggeschreven.\n\nReden: ${error.message}`,
      response: '',
      intent: 'resume',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }

  await logAction(db, 'resume_dispatch', `Hervat-taken aangemaakt voor ${hosts.join(', ')}`, { ids: (data ?? []).map((r) => r.id) })

  const lines = hosts.map((h) => `• ${hostLabel(h)}: ga verder met de huidige build-/audittaak`)
  return {
    reply: `Begrepen. Ik heb ${hosts.length} hervat-taak${hosts.length > 1 ? 'en' : ''} in de dispatch-wachtrij gezet:\n${lines.join('\n')}\n\nDe Claude-sessie op elke host pakt dit op via het dispatch-bord. Gelogd in het Hermes-logboek.`,
    response: '',
    intent: 'resume',
    understood: true,
    actions: (data ?? []).map((r) => ({ label: `${r.target_host} → queued`, detail: r.title })),
    suggestions: ['Wat is de status van CLI L?', 'Welke taken staan open?'],
  }
}

async function handleHostStatus(db: AdminClient, cmd: ParsedCommand): Promise<HermesReply> {
  const targets = (cmd.hosts.length ? cmd.hosts : ['cli-l', 'cli-r']) as HostId[]
  const { data: hostsRows, error } = await db
    .schema('hermes')
    .from('hosts')
    .select('host_id, label, active, last_seen_at')
    .in('host_id', targets)

  if (error) {
    return {
      reply: `Geen data gevonden: het hermes-schema is niet bereikbaar (${error.message}). Controleer of migraties 109/110 zijn toegepast op deze database.`,
      response: '',
      intent: 'host_status',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  if (!hostsRows || hostsRows.length === 0) {
    return {
      reply: 'Geen data gevonden: er zijn geen hosts geregistreerd in hermes.hosts.',
      response: '',
      intent: 'host_status',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }

  const lines: string[] = []
  for (const h of hostsRows) {
    const counts: Record<string, number> = {}
    for (const st of ['queued', 'claimed', 'running'] as const) {
      const { count } = await db
        .schema('hermes')
        .from('dispatch_queue')
        .select('id', { count: 'exact', head: true })
        .in('target_host', [h.host_id, 'any'])
        .eq('status', st)
      counts[st] = count ?? 0
    }
    lines.push(
      `• ${h.host_id} (${h.active ? 'actief' : 'inactief'}, ${ago(h.last_seen_at)}): ` +
        `${counts.queued} queued · ${counts.claimed} claimed · ${counts.running} running`,
    )
  }

  return {
    reply: `Host-status:\n${lines.join('\n')}`,
    response: '',
    intent: 'host_status',
    understood: true,
    actions: [],
    suggestions: ['Ga verder op CLI L en CLI R', 'Welke taken staan open?'],
    data: hostsRows,
  }
}

async function handleCreateTask(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  if (!cmd.title) {
    return {
      reply:
        'Ik begreep dat je een taak wilt aanmaken' +
        (cmd.hosts.length ? ` voor ${cmd.hosts.map(hostLabel).join(' + ')}` : '') +
        ', maar de taakomschrijving ontbreekt. Geef de taak na een dubbele punt, bv.:\n' +
        '"Maak een taak aan voor CLI L: checkout end-to-end testen".',
      response: '',
      intent: 'create_task',
      understood: true,
      actions: [],
      suggestions: ['Maak een taak aan voor CLI L: checkout end-to-end testen'],
    }
  }
  const target: HostId | 'any' = cmd.hosts.length === 1 ? cmd.hosts[0] : 'any'
  const { data, error } = await db
    .schema('hermes')
    .from('dispatch_queue')
    .insert({
      title: cmd.title,
      workstream: 'manual',
      target_host: target,
      priority: 5,
      payload: { requested_by: 'orlando', via: 'command-center', company_id: companyId },
    })
    .select('id, title, target_host')
    .maybeSingle()

  if (error) {
    return {
      reply: `Kon de taak niet aanmaken. Reden: ${error.message}`,
      response: '',
      intent: 'create_task',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  await logAction(db, 'create_task', `Taak aangemaakt: ${cmd.title}`, { id: data?.id, target_host: target })
  return {
    reply: `Taak aangemaakt in de dispatch-wachtrij (host: ${target}):\n• ${cmd.title}\n\nVerschijnt op het dispatch-bord en wordt opgepakt door de eerstvolgende sessie op die host.`,
    response: '',
    intent: 'create_task',
    understood: true,
    actions: [{ label: `${target} → queued`, detail: cmd.title }],
    suggestions: ['Welke taken staan open?'],
  }
}

async function handleStartPhase(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  const title = cmd.title!
  const target: HostId | 'any' = cmd.hosts.length === 1 ? cmd.hosts[0] : 'any'
  const { data, error } = await db
    .schema('hermes')
    .from('dispatch_queue')
    .insert({
      title: `Start fase/gate: ${title}`,
      workstream: 'phase-gate',
      target_host: target,
      priority: 2,
      payload: { phase: title, instruction: 'start', requested_by: 'orlando', via: 'command-center', company_id: companyId },
    })
    .select('id')
    .maybeSingle()

  if (error) {
    return {
      reply: `Kon fase/gate "${title}" niet starten. Reden: ${error.message}`,
      response: '',
      intent: 'start_phase',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  await logAction(db, 'start_phase', `Fase/gate gestart: ${title}`, { id: data?.id, target_host: target })
  return {
    reply: `Fase/gate "${title}" is als taak in de wachtrij gezet (host: ${target}, hoge prioriteit). De uitvoerende sessie pakt dit op.`,
    response: '',
    intent: 'start_phase',
    understood: true,
    actions: [{ label: `${target} → queued`, detail: `Start: ${title}` }],
    suggestions: ['Welke taken staan open?', 'Controleer Build Tracker'],
  }
}

async function handleAuditMode(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  const hosts = (cmd.hosts.length ? cmd.hosts : ['cli-r']) as HostId[]
  const rows = hosts.map((h) => ({
    title: `Auditmodus: ${hostLabel(h)} draait controles i.p.v. nieuwe builds`,
    workstream: 'audit',
    target_host: h,
    priority: 2,
    payload: { mode: 'audit', requested_by: 'orlando', via: 'command-center', company_id: companyId },
  }))
  const { data, error } = await db.schema('hermes').from('dispatch_queue').insert(rows).select('id, target_host')
  if (error) {
    return {
      reply: `Kon auditmodus niet inschakelen. Reden: ${error.message}`,
      response: '',
      intent: 'audit_mode',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  await logAction(db, 'audit_mode', `Auditmodus aangevraagd voor ${hosts.join(', ')}`, { ids: (data ?? []).map((r) => r.id) })
  return {
    reply: `Auditmodus aangevraagd voor ${hosts.map(hostLabel).join(' + ')}. Taak staat in de wachtrij; de sessie op die host schakelt over naar controle/handoff.`,
    response: '',
    intent: 'audit_mode',
    understood: true,
    actions: (data ?? []).map((r) => ({ label: `${r.target_host} → audit`, detail: 'auditmodus' })),
    suggestions: ['Wat is de status van CLI R?'],
  }
}

async function handleRemember(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  const text = cmd.memory!
  const { error } = await db
    .schema('hermes')
    .from('memory')
    .insert({
      scope: `company:${companyId}`,
      key: `note:${new Date().toISOString()}`,
      value: { text, source: 'command-center', requested_by: 'orlando' },
      importance: 6,
    })
  if (error) {
    return {
      reply: `Kon dit niet onthouden. Reden: ${error.message}`,
      response: '',
      intent: 'remember',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  await logAction(db, 'remember', 'Notitie opgeslagen in hermes.memory', { scope: `company:${companyId}` })
  return {
    reply: `Onthouden. Opgeslagen in het Hermes-geheugen:\n• ${text}`,
    response: '',
    intent: 'remember',
    understood: true,
    actions: [],
    suggestions: [],
  }
}

async function handleBuildTracker(db: AdminClient, companyId: string, openOnly: boolean): Promise<HermesReply> {
  const { data, error } = await db
    .from('build_tracker')
    .select('name, status, progress_pct, owner, current_milestone')
    .eq('company_id', companyId)
    .order('progress_pct', { ascending: false })

  if (error) {
    return {
      reply: `Geen data gevonden: build_tracker is niet bereikbaar (${error.message}).`,
      response: '',
      intent: openOnly ? 'open_tasks' : 'build_tracker',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  const rows = data ?? []
  if (rows.length === 0) {
    return {
      reply: 'Geen data gevonden: er staan geen build-tracker items voor de actieve company. Wissel evt. van company rechtsboven.',
      response: '',
      intent: openOnly ? 'open_tasks' : 'build_tracker',
      understood: true,
      actions: [],
      suggestions: ['Wat blokkeert omzet vandaag?'],
    }
  }

  const byStatus = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {})
  const summary = Object.entries(byStatus)
    .map(([s, n]) => `${n}× ${s}`)
    .join(' · ')

  const openStatuses = ['planned', 'building', 'aandacht_nodig', 'blocked', 'in_progress']
  const focus = (openOnly ? rows.filter((r) => openStatuses.includes(r.status)) : rows).slice(0, 8)
  const lines = focus.map(
    (r) => `• ${r.name} — ${r.status} ${r.progress_pct}%${r.owner ? ` · ${r.owner}` : ''}`,
  )

  return {
    reply:
      `Build Tracker (${rows.length} items): ${summary}\n\n` +
      `${openOnly ? 'Open/lopend' : 'Top items'}:\n${lines.join('\n')}`,
    response: '',
    intent: openOnly ? 'open_tasks' : 'build_tracker',
    understood: true,
    actions: [],
    suggestions: ['Wat blokkeert omzet vandaag?', 'Ga verder op CLI L en CLI R'],
    data: focus,
  }
}

async function handleRevenueBlockers(db: AdminClient): Promise<HermesReply> {
  // Ecosysteem-breed: omzet-dragende builds die nog niet live zijn.
  const { data: builds, error } = await db
    .from('build_tracker')
    .select('name, status, progress_pct, owner, current_milestone, expected_revenue_amount')
    .in('status', ['building', 'aandacht_nodig', 'blocked', 'in_progress'])
    .order('progress_pct', { ascending: false })
    .limit(10)

  const parts: string[] = []
  if (error) {
    parts.push(`Build Tracker niet bereikbaar (${error.message}).`)
  } else if (!builds || builds.length === 0) {
    parts.push('Geen lopende omzet-dragende builds gevonden in de Build Tracker.')
  } else {
    parts.push('Lopende builds op het kritieke pad naar omzet:')
    for (const b of builds.slice(0, 6)) {
      const ms = b.current_milestone ? ` — ${b.current_milestone.slice(0, 140)}` : ''
      parts.push(`• ${b.name} (${b.status} ${b.progress_pct}%${b.owner ? `, ${b.owner}` : ''})${ms}`)
    }
  }

  // Open escalaties (best-effort)
  try {
    const { count } = await db
      .schema('hermes')
      .from('escalations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'sending', 'sent'])
    if (typeof count === 'number') parts.push(`\nOpen escalaties: ${count}`)
  } catch {
    /* schema kan ontbreken */
  }

  // Kritieke/high validation-findings (best-effort)
  try {
    const { count } = await db
      .schema('hermes')
      .from('validation_errors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open')
      .in('severity', ['critical', 'high'])
    if (typeof count === 'number') parts.push(`Open kritieke/high findings: ${count}`)
  } catch {
    /* schema kan ontbreken */
  }

  parts.push('\nAdvies: prioriteer het item met de hoogste voortgang dat live-geld oplevert; dispatch de resterende blockers naar CLI-L/CLI-R.')

  return {
    reply: parts.join('\n'),
    response: '',
    intent: 'revenue_blockers',
    understood: true,
    actions: [],
    suggestions: ['Ga verder op CLI L en CLI R', 'Controleer Build Tracker'],
  }
}

async function handleUploads(db: AdminClient): Promise<HermesReply> {
  const statuses = [
    'queued',
    'uploading',
    'processing',
    'verifying',
    'verified_live',
    'failed',
    'manual_review_required',
  ] as const
  const counts: Record<string, number> = {}
  for (const st of statuses) {
    const { count } = await db
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', st)
    counts[st] = count ?? 0
  }

  const { data: recent, error } = await db
    .from('youtube_upload_queue')
    .select('id, status, title, retry_count, updated_at')
    .order('updated_at', { ascending: false })
    .limit(8)

  if (error) {
    return {
      reply: `Geen data: youtube_upload_queue niet bereikbaar (${error.message}).`,
      response: '',
      intent: 'uploads',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }

  const summary =
    statuses.filter((s) => counts[s] > 0).map((s) => `${counts[s]}× ${s}`).join(' · ') || 'geen uploads'
  const lines = (recent ?? []).map(
    (r) => `• ${String(r.title ?? r.id).slice(0, 48)} — ${r.status}${r.retry_count ? ` (retry ${r.retry_count})` : ''}`,
  )

  return {
    reply: `Upload-queue: ${summary}.${lines.length ? `\n\nLaatste:\n${lines.join('\n')}` : ''}`,
    response: '',
    intent: 'uploads',
    understood: true,
    actions: [],
    suggestions: ['Wat is er mis met de uploads?', 'Welke taken staan open?'],
    data: { counts, recent: recent ?? [] },
  }
}

async function handleUploadProblems(db: AdminClient): Promise<HermesReply> {
  const { data: stuck } = await db
    .from('youtube_upload_queue')
    .select('id, status, title, retry_count, last_error, updated_at')
    .in('status', ['failed', 'manual_review_required'])
    .order('updated_at', { ascending: false })
    .limit(12)

  const { data: holdingFailed } = await db
    .from('media_holding_uploads')
    .select('id, platform, error, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(8)

  const rows = stuck ?? []
  const hold = holdingFailed ?? []

  if (rows.length === 0 && hold.length === 0) {
    return {
      reply: 'Geen vastgelopen of gefaalde uploads gevonden. De pipeline is schoon.',
      response: '',
      intent: 'upload_problems',
      understood: true,
      actions: [],
      suggestions: ['Hoe staan de uploads?'],
    }
  }

  const lines = rows.map(
    (r) =>
      `• ${String(r.title ?? '(zonder titel)').slice(0, 42)} [${r.status}] — ${String(r.last_error ?? 'geen detail').slice(0, 80)}\n  id: ${r.id}`,
  )
  const holdLines = hold.map((h) => `• media-holding ${h.platform} — ${String(h.error ?? 'geen detail').slice(0, 70)}`)

  const parts = [`${rows.length} vastgelopen/gefaalde YouTube-uploads:`, ...lines]
  if (holdLines.length) parts.push('', `Gefaalde media-holding uploads (${holdLines.length}):`, ...holdLines)
  parts.push('', 'Opnieuw proberen kan met: "Retry upload <id>".')

  return {
    reply: parts.join('\n'),
    response: '',
    intent: 'upload_problems',
    understood: true,
    actions: rows.slice(0, 5).map((r) => ({ label: `retry ${r.id.slice(0, 8)}`, detail: r.title ?? r.status })),
    suggestions: rows.length ? [`Retry upload ${rows[0].id}`, 'Hoe staan de uploads?'] : ['Hoe staan de uploads?'],
    data: { stuck: rows, holdingFailed: hold },
  }
}

async function handleRetryUpload(db: AdminClient, cmd: ParsedCommand): Promise<HermesReply> {
  if (!cmd.uploadId) {
    const { data } = await db
      .from('youtube_upload_queue')
      .select('id, title, status')
      .in('status', ['failed', 'manual_review_required'])
      .order('updated_at', { ascending: false })
      .limit(8)
    const list = data ?? []
    const lines = list.map((r) => `• ${r.id} — ${r.title ?? r.status}`)
    return {
      reply: lines.length
        ? `Welke upload wil je opnieuw proberen? Geef het id, bv. "Retry upload ${list[0].id}".\n\nGefaald/vastgelopen:\n${lines.join('\n')}`
        : 'Geen gefaalde uploads om opnieuw te proberen.',
      response: '',
      intent: 'retry_upload',
      understood: true,
      actions: [],
      suggestions: ['Wat is er mis met de uploads?'],
    }
  }

  const { data: row, error } = await db
    .from('youtube_upload_queue')
    .select('id, status')
    .eq('id', cmd.uploadId)
    .maybeSingle()

  if (error) {
    return {
      reply: `Kon upload niet ophalen: ${error.message}`,
      response: '',
      intent: 'retry_upload',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  if (!row) {
    return {
      reply: `Geen upload gevonden met id ${cmd.uploadId}.`,
      response: '',
      intent: 'retry_upload',
      understood: true,
      actions: [],
      suggestions: ['Wat is er mis met de uploads?'],
    }
  }
  if (!['failed', 'manual_review_required'].includes(row.status)) {
    return {
      reply: `Upload ${cmd.uploadId.slice(0, 8)}… heeft status "${row.status}" — alleen failed/manual_review_required mag opnieuw.`,
      response: '',
      intent: 'retry_upload',
      understood: true,
      actions: [],
      suggestions: ['Hoe staan de uploads?'],
    }
  }

  const { error: uErr } = await db
    .from('youtube_upload_queue')
    .update({ status: 'queued', last_error: null, updated_at: new Date().toISOString() })
    .eq('id', cmd.uploadId)
  if (uErr) {
    return {
      reply: `Kon upload niet opnieuw in de wachtrij zetten: ${uErr.message}`,
      response: '',
      intent: 'retry_upload',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
  await db
    .from('youtube_upload_failures')
    .update({ recovery_attempted: true })
    .eq('queue_id', cmd.uploadId)
    .eq('recovery_attempted', false)
  await logAction(db, 'retry_upload', `Upload ${cmd.uploadId} terug naar queued`, { queue_id: cmd.uploadId })

  return {
    reply: `Upload ${cmd.uploadId.slice(0, 8)}… staat weer op "queued". De pipeline pakt 'm opnieuw op.`,
    response: '',
    intent: 'retry_upload',
    understood: true,
    actions: [{ label: '→ queued', detail: cmd.uploadId }],
    suggestions: ['Hoe staan de uploads?'],
  }
}

async function handleWebResearch(cmd: ParsedCommand): Promise<HermesReply> {
  const key = process.env.PERPLEXITY_API_KEY
  const query = (cmd.query || cmd.raw).trim()

  if (!key) {
    return {
      reply:
        'Web-research is nog niet geconfigureerd: zet PERPLEXITY_API_KEY in de env (.env.prod of frontend/.env.local) en redeploy. Daarna beantwoord ik dit live via Perplexity.',
      response: '',
      intent: 'web_research',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }

  try {
    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: 'Je bent een onderzoeksassistent voor Orlando. Antwoord beknopt in het Nederlands met feiten en, waar relevant, bronnen.',
          },
          { role: 'user', content: query },
        ],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return {
        reply: `Perplexity-fout (HTTP ${res.status}). ${detail.slice(0, 160)}`,
        response: '',
        intent: 'web_research',
        understood: true,
        actions: [],
        suggestions: SUGGESTIONS,
      }
    }

    const data = await res.json()
    const answer: string = data?.choices?.[0]?.message?.content ?? 'Geen antwoord ontvangen.'
    const cites: string[] = Array.isArray(data?.citations)
      ? data.citations
      : Array.isArray(data?.search_results)
        ? data.search_results.map((s: { url?: string }) => s.url).filter(Boolean)
        : []
    const sources = cites.slice(0, 5).map((u, i) => `[${i + 1}] ${u}`)

    return {
      reply: `${answer}${sources.length ? `\n\nBronnen:\n${sources.join('\n')}` : ''}`,
      response: '',
      intent: 'web_research',
      understood: true,
      actions: [],
      suggestions: ['Wat blokkeert omzet vandaag?', 'Hoe staan de uploads?'],
      data: { citations: cites },
    }
  } catch (e) {
    return {
      reply: `Kon Perplexity niet bereiken: ${e instanceof Error ? e.message : 'netwerkfout'}`,
      response: '',
      intent: 'web_research',
      understood: true,
      actions: [],
      suggestions: SUGGESTIONS,
    }
  }
}

function handleHelp(): HermesReply {
  const lines = COMMAND_HELP.map((c) => `• ${c.label}: "${c.example}"`)
  return {
    reply: `Ik ben Hermes — de command router van Orlando Core OS. Ik begrijp o.a.:\n${lines.join('\n')}`,
    response: '',
    intent: 'help',
    understood: true,
    actions: [],
    suggestions: SUGGESTIONS.slice(0, 4),
  }
}

/** Vrije-tekst: probeer een nuttig antwoord via de (gateway-aware) AI-client, met echte context. */
async function handleUnknown(db: AdminClient, cmd: ParsedCommand, companyId: string): Promise<HermesReply> {
  // Korte, echte context opbouwen
  let context = ''
  try {
    const { data: builds } = await db
      .from('build_tracker')
      .select('name, status, progress_pct')
      .eq('company_id', companyId)
      .order('progress_pct', { ascending: false })
      .limit(6)
    if (builds?.length) context += `Build Tracker: ${builds.map((b) => `${b.name} (${b.status} ${b.progress_pct}%)`).join('; ')}. `
  } catch {
    /* negeer */
  }

  const fallback: HermesReply = {
    reply:
      `Ik heb je bericht ontvangen maar kon het niet aan een commando koppelen.\n` +
      `• Wat ik begreep: "${cmd.raw}" (geen herkende opdracht)\n` +
      `• Wat ik niet begreep: welke actie je wilt\n` +
      `• Beschikbare acties: ${COMMAND_HELP.map((c) => c.label).join(', ')}\n` +
      `• Suggestie: probeer bv. "${COMMAND_HELP[0].example}" of typ "help".`,
    response: '',
    intent: 'unknown',
    understood: false,
    actions: [],
    suggestions: SUGGESTIONS,
  }

  try {
    const system =
      `Je bent Hermes, de command router van Orlando Core OS (vastgoed/bouw/SaaS-ecosysteem, CLI-L en CLI-R hosts). ` +
      `Antwoord in het Nederlands, kort en actionable (max 4 zinnen). ` +
      `Als de vraag niet om data of een actie vraagt die je kent, zeg dan eerlijk wat je begreep en stel een geldig commando voor uit deze lijst: ` +
      COMMAND_HELP.map((c) => c.example).join(' | ') +
      `. Verzin geen statussen; gebruik alleen de meegegeven context.`
    const { text } = await generateText({
      model: claude.sonnet,
      system,
      prompt: `Context: ${context || 'geen extra context beschikbaar'}\n\nVraag van Orlando: ${cmd.raw}`,
      maxOutputTokens: 400,
    })
    if (text?.trim()) {
      return { ...fallback, reply: text.trim(), understood: true }
    }
    return fallback
  } catch {
    // AI niet beschikbaar (geen key/gateway) → gestructureerde fallback (nooit een vaste standaardzin)
    return fallback
  }
}

// ── route ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Auth: alleen ingelogde gebruikers
    const auth = await createClient()
    const {
      data: { user },
    } = await auth.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { company_id, message } = body as { company_id?: string; message?: string }

    if (!company_id || !message?.trim()) {
      return NextResponse.json({ error: 'Missing company_id or message' }, { status: 400 })
    }

    const db = createAdminClient()
    const cmd = parseCommand(message)

    let result: HermesReply
    switch (cmd.kind) {
      case 'resume':
        result = await handleResume(db, cmd, company_id)
        break
      case 'host_status':
        result = await handleHostStatus(db, cmd)
        break
      case 'create_task':
        result = await handleCreateTask(db, cmd, company_id)
        break
      case 'start_phase':
        result = await handleStartPhase(db, cmd, company_id)
        break
      case 'audit_mode':
        result = await handleAuditMode(db, cmd, company_id)
        break
      case 'remember':
        result = await handleRemember(db, cmd, company_id)
        break
      case 'build_tracker':
        result = await handleBuildTracker(db, company_id, false)
        break
      case 'open_tasks':
        result = await handleBuildTracker(db, company_id, true)
        break
      case 'revenue_blockers':
        result = await handleRevenueBlockers(db)
        break
      case 'uploads':
        result = await handleUploads(db)
        break
      case 'upload_problems':
        result = await handleUploadProblems(db)
        break
      case 'retry_upload':
        result = await handleRetryUpload(db, cmd)
        break
      case 'web_research':
        result = await handleWebResearch(cmd)
        break
      case 'help':
        result = handleHelp()
        break
      default:
        result = await handleUnknown(db, cmd, company_id)
        break
    }

    return reply(result)
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Onbekende fout'
    console.error('Hermes command router fout:', detail)
    return NextResponse.json(
      {
        reply: `Interne fout bij het verwerken van je opdracht: ${detail}`,
        response: `Interne fout bij het verwerken van je opdracht: ${detail}`,
        intent: 'unknown',
        understood: false,
        actions: [],
        suggestions: SUGGESTIONS,
        error: 'internal_error',
        details: detail,
      },
      { status: 500 },
    )
  }
}
