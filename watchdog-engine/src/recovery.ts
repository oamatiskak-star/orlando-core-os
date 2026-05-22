import { RenderClient, RenderDeploy, RenderService, DeployStatus } from './render-client'
import { sendTelegram } from './telegram'
import { recordEvent, openIncident, resolveIncident } from './supabase-state'

const FAILED_STATES: DeployStatus[] = ['build_failed', 'update_failed', 'pre_deploy_failed', 'canceled']

interface RecoveryState {
  attempts: number
  lastAttemptAt: number
  escalated: boolean
}

const recoveryByDeploy = new Map<string, RecoveryState>()
const lastSeenDeployStatus = new Map<string, DeployStatus>()
const ATTEMPT_COOLDOWN_MS = 4 * 60 * 1000

export interface CheckOptions {
  selfServiceId?: string
  denyList: Set<string>
  ownerId: string
  maxAttempts: number
}

export async function checkFleet(client: RenderClient, opts: CheckOptions): Promise<void> {
  let services: RenderService[]
  try {
    services = await client.listServices()
  } catch (err) {
    console.error('[watchdog] listServices failed:', err instanceof Error ? err.message : err)
    return
  }

  const checked: string[] = []
  for (const svc of services) {
    if (svc.suspended === 'suspended') continue
    if (svc.type === 'redis' || svc.type === 'static_site') continue
    if (opts.selfServiceId && svc.id === opts.selfServiceId) continue
    if (opts.denyList.has(svc.name) || opts.denyList.has(svc.id)) continue
    checked.push(svc.name)
    try {
      await checkService(client, svc, opts)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[watchdog] checkService(${svc.name}) error:`, msg)
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'check_error',
        message: msg
      })
    }
  }
  console.log(`[watchdog] tick: checked ${checked.length} services`)
}

async function checkService(client: RenderClient, svc: RenderService, opts: CheckOptions): Promise<void> {
  const deploys = await client.listDeploys(svc.id, 3)
  if (deploys.length === 0) return
  const latest = deploys[0]

  const previousStatus = lastSeenDeployStatus.get(svc.id)
  lastSeenDeployStatus.set(svc.id, latest.status)

  if (latest.status === 'live') {
    if (previousStatus && FAILED_STATES.includes(previousStatus)) {
      await sendTelegram('info', `✅ ${svc.name} recovered`, `Service is live again (deploy ${latest.id}).`)
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'recovered',
        deploy_id: latest.id,
        deploy_status: latest.status
      })
    }
    // Cleanup recovery state for prior failed deploys on this service
    for (const d of deploys) if (FAILED_STATES.includes(d.status)) {
      recoveryByDeploy.delete(d.id)
      await resolveIncident(d.id)
    }
    return
  }

  if (!FAILED_STATES.includes(latest.status)) return

  await handleFailure(client, svc, latest, opts)
}

async function handleFailure(
  client: RenderClient,
  svc: RenderService,
  deploy: RenderDeploy,
  opts: CheckOptions
): Promise<void> {
  const state = recoveryByDeploy.get(deploy.id) ?? { attempts: 0, lastAttemptAt: 0, escalated: false }

  // First-time detection: alert + first recovery action
  if (state.attempts === 0) {
    console.log(`[watchdog] FAIL ${svc.name} deploy=${deploy.id} status=${deploy.status}`)
    await recordEvent({
      service_id: svc.id,
      service_name: svc.name,
      service_type: svc.type,
      kind: 'fail_detected',
      deploy_id: deploy.id,
      deploy_status: deploy.status,
      message: deploy.commit?.message ?? null
    })
    await sendTelegram(
      'error',
      `🔴 ${svc.name} deploy ${deploy.status}`,
      [
        `Service: ${svc.name} (${svc.type})`,
        `Deploy: ${deploy.id}`,
        deploy.commit ? `Commit: ${deploy.commit.id.slice(0, 7)} ${deploy.commit.message}` : '',
        `Watchdog: kicking off recovery (attempt 1/${opts.maxAttempts})`
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (state.escalated) return
  if (state.attempts >= opts.maxAttempts) {
    await escalate(client, svc, deploy, state, opts)
    return
  }

  const now = Date.now()
  if (now - state.lastAttemptAt < ATTEMPT_COOLDOWN_MS) return

  state.attempts += 1
  state.lastAttemptAt = now
  recoveryByDeploy.set(deploy.id, state)

  const isBuildFailure = deploy.status === 'build_failed' || deploy.status === 'pre_deploy_failed'
  try {
    if (isBuildFailure) {
      const clearCache = state.attempts >= 2
      const newDeploy = await client.triggerDeploy(svc.id, { clearCache })
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'redeploy_triggered',
        deploy_id: newDeploy.id,
        attempt: state.attempts,
        message: clearCache ? 'redeploy with clearCache' : 'redeploy'
      })
      await sendTelegram(
        'warning',
        `🔁 ${svc.name} redeploy attempt ${state.attempts}/${opts.maxAttempts}`,
        `New deploy ${newDeploy.id}${clearCache ? ' (cache cleared)' : ''}`
      )
    } else {
      await client.restartService(svc.id)
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'restart_triggered',
        deploy_id: deploy.id,
        attempt: state.attempts
      })
      await sendTelegram(
        'warning',
        `🔁 ${svc.name} restart attempt ${state.attempts}/${opts.maxAttempts}`,
        `Triggered restart for deploy ${deploy.id}`
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[watchdog] recovery action failed for ${svc.name}:`, msg)
    await recordEvent({
      service_id: svc.id,
      service_name: svc.name,
      service_type: svc.type,
      kind: 'check_error',
      deploy_id: deploy.id,
      attempt: state.attempts,
      message: `recovery action failed: ${msg}`
    })
  }
}

async function escalate(
  client: RenderClient,
  svc: RenderService,
  deploy: RenderDeploy,
  state: RecoveryState,
  opts: CheckOptions
): Promise<void> {
  state.escalated = true
  recoveryByDeploy.set(deploy.id, state)

  const start = deploy.createdAt ? new Date(deploy.createdAt) : undefined
  const end = deploy.finishedAt ? new Date(deploy.finishedAt) : undefined
  const logType: 'build' | 'app' = deploy.status === 'build_failed' || deploy.status === 'pre_deploy_failed' ? 'build' : 'app'
  let logsTail = ''
  try {
    logsTail = await client.fetchLogs({
      ownerId: opts.ownerId,
      resourceId: svc.id,
      type: logType,
      limit: 80,
      startTime: start,
      endTime: end ? new Date(end.getTime() + 2 * 60_000) : undefined
    })
  } catch (err) {
    logsTail = `(failed to fetch logs: ${err instanceof Error ? err.message : err})`
  }

  const proposed = [
    `Inspect Render dashboard: https://dashboard.render.com/web/${svc.id}`,
    isLikelyTypeScriptError(logsTail) ? 'Likely TypeScript/build error — patch source then push to main' : 'Inspect crash logs and restart',
    'Once fixed, push to main; Render auto-deploys',
    `Optional: watchdog can be re-armed by clearing infra_watchdog_incidents row for deploy_id=${deploy.id}`
  ]

  await openIncident({
    service_id: svc.id,
    service_name: svc.name,
    service_type: svc.type,
    deploy_id: deploy.id,
    failure_kind: deploy.status,
    failure_summary: deploy.commit?.message ?? `Deploy ${deploy.id} ${deploy.status}`,
    logs_tail: logsTail.slice(-6000),
    commit_sha: deploy.commit?.id,
    commit_message: deploy.commit?.message,
    attempts_made: state.attempts,
    proposed_actions: proposed
  })
  await recordEvent({
    service_id: svc.id,
    service_name: svc.name,
    service_type: svc.type,
    kind: 'escalated',
    deploy_id: deploy.id,
    deploy_status: deploy.status,
    attempt: state.attempts,
    message: 'opened infra_watchdog_incidents row for Claude Code agent pickup'
  })
  await sendTelegram(
    'critical',
    `🚨 ${svc.name} needs human/Claude Code fix`,
    [
      `Service ${svc.name} (${svc.type}) failed ${state.attempts} recovery attempts.`,
      `Deploy: ${deploy.id} (${deploy.status})`,
      deploy.commit ? `Commit: ${deploy.commit.id.slice(0, 7)} ${deploy.commit.message}` : '',
      '',
      'Last log lines:',
      tailLines(logsTail, 12),
      '',
      `Incident opened in infra_watchdog_incidents.deploy_id='${deploy.id}'.`,
      `Dashboard: https://dashboard.render.com/web/${svc.id}`
    ]
      .filter(Boolean)
      .join('\n')
  )
}

function isLikelyTypeScriptError(logs: string): boolean {
  return /error TS\d+:|Type error:|Cannot find name|Property '\w+' does not exist/i.test(logs)
}

function tailLines(s: string, n: number): string {
  const lines = s.split('\n').filter(Boolean)
  return lines.slice(-n).join('\n')
}
