import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Gedeelde server-logica voor het Affiliate Activation Center (migratie 209).
 *
 * Eén bron voor de one-click activatie, GO-LIVE en content-koppeling — aangeroepen
 * door de API-routes onder /api/account-setup/activation/*. Schrijfacties draaien via
 * de service-role admin-client (RLS migratie 100: authenticated read-only).
 *
 * Hergebruikt 100% de bestaande motoren: account_setup_runs (agent-queue),
 * affiliate_setup_readiness() (MANUAL-detectie), de affiliate_go_live()-trigger
 * (approval + link-activatie + rank + recommendations) en activate_channel_content_links()
 * → auto_generate_affiliate_link().
 */

type AuditDetail = Record<string, unknown>

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  programId: string | null,
  runId: string | null,
  action: string,
  actorId: string | null,
  detail: AuditDetail = {},
) {
  await admin.from('account_setup_audit_log').insert({
    program_id: programId,
    run_id: runId,
    action,
    actor: 'user',
    actor_id: actorId,
    detail,
  })
}

export type ActivationRunIds = {
  setup: string | null
  terms: string | null
  browser: string | null
}

/**
 * Fase 2 — ACTIVEER PROGRAMMA. Zet de volledige agent-sequence in de queue en laat
 * Hermes alles uitvoeren wat technisch mogelijk is:
 *   1) account_setup        → Setup Agent (checklist/documenten uit template)
 *   2) terms_analysis       → MCP/Discovery-kennislaag (voorwaarden + payout-samenvatting)
 *   3) browser_registration → OAuth/registratie-runner met auto_submit (externe aanvraag)
 * Daarna affiliate_setup_readiness() → ontbrekende EXTERNE stappen worden direct als
 * MANUAL REQUIRED zichtbaar (Fase 3).
 */
export async function enqueueActivationSequence(
  programId: string,
  actorId: string | null,
): Promise<ActivationRunIds> {
  const admin = createAdminClient()

  const { data: prog, error: progErr } = await admin
    .from('affiliate_programs')
    .select('id, name')
    .eq('id', programId)
    .maybeSingle()
  if (progErr) throw new Error(progErr.message)
  if (!prog) throw new Error(`Programma ${programId} niet gevonden`)

  const gmailLabel = `Affiliates/${prog.name}`

  // 1) Setup Agent
  const { data: setupRun } = await admin
    .from('account_setup_runs')
    .insert({ program_id: programId, run_kind: 'account_setup', status: 'queued', trigger_kind: 'manual', payload: { stage: 'setup' } })
    .select('id')
    .single()

  // 2) MCP / Discovery kennislaag (voorwaarden-analyse)
  const { data: termsRun } = await admin
    .from('account_setup_runs')
    .insert({ program_id: programId, run_kind: 'terms_analysis', status: 'queued', trigger_kind: 'manual', payload: { stage: 'terms' } })
    .select('id')
    .single()

  // 3) Browser-registratie met volledige auto-submit (externe aanvraag)
  const { data: browserRun } = await admin
    .from('account_setup_runs')
    .insert({
      program_id: programId,
      run_kind: 'browser_registration',
      status: 'queued',
      trigger_kind: 'manual',
      payload: { stage: 'registration', gmail_label: gmailLabel, auto_submit: true },
    })
    .select('id')
    .single()

  // MANUAL REQUIRED-detectie: ontbrekende externe stappen → human-action queue
  await admin.rpc('affiliate_setup_readiness')

  const runIds: ActivationRunIds = {
    setup: setupRun?.id ?? null,
    terms: termsRun?.id ?? null,
    browser: browserRun?.id ?? null,
  }

  await audit(admin, programId, runIds.setup, 'activation.enqueued', actorId, { runs: runIds, auto_submit: true })
  return runIds
}

/**
 * Fase 4 — GO LIVE. Zodra referral_code of affiliate_link bekend is: schrijf de keys en
 * zet account_status='active'. De bestaande affiliate_go_live()-trigger doet de rest
 * (approval_status='approved', links activeren, rank_affiliate_programs,
 * generate_affiliate_recommendations).
 */
export async function goLive(
  programId: string,
  referralCode: string | null,
  affiliateLink: string | null,
  actorId: string | null,
): Promise<void> {
  if (!referralCode && !affiliateLink) {
    throw new Error('referral_code of affiliate_link is verplicht om live te gaan')
  }
  const admin = createAdminClient()

  const patch: Record<string, unknown> = {
    account_status: 'active',
    last_status_check_at: new Date().toISOString(),
  }
  if (referralCode) patch.referral_code = referralCode
  if (affiliateLink) patch.affiliate_link = affiliateLink

  const { error } = await admin.from('affiliate_programs').update(patch).eq('id', programId)
  if (error) throw new Error(error.message)

  await audit(admin, programId, null, 'activation.go_live', actorId, {
    has_referral: Boolean(referralCode),
    has_link: Boolean(affiliateLink),
  })
}

/**
 * Fase 5 — content-koppeling. Genereert affiliate-links voor de top-N content-items per
 * gekoppeld kanaal via activate_channel_content_links() (idempotent). Zonder channelId:
 * loop over alle actieve kanaal-koppelingen van het programma.
 */
export async function generateChannelContentLinks(
  programId: string,
  channelId: string | null,
  topN: number,
  actorId: string | null,
): Promise<number> {
  const admin = createAdminClient()

  let channelIds: string[]
  if (channelId) {
    channelIds = [channelId]
  } else {
    const { data: maps, error } = await admin
      .from('affiliate_channel_mappings')
      .select('channel_id')
      .eq('affiliate_program_id', programId)
      .eq('is_active', true)
    if (error) throw new Error(error.message)
    channelIds = (maps ?? []).map(m => m.channel_id as string)
  }

  let created = 0
  for (const cid of channelIds) {
    const { data, error } = await admin.rpc('activate_channel_content_links', {
      p_program_id: programId,
      p_channel_id: cid,
      p_top_n: topN,
    })
    if (error) throw new Error(error.message)
    created += Number(data ?? 0)
  }

  await audit(admin, programId, null, 'activation.content_linked', actorId, {
    channels: channelIds.length,
    created,
    top_n: topN,
  })
  return created
}
