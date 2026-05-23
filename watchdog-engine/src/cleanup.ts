import { RenderClient, RenderService } from './render-client'
import { sendTelegram } from './telegram'
import { recordEvent } from './supabase-state'

export interface CleanupOptions {
  selfServiceId?: string
  denyList: Set<string>
  suspendedDays: number
  enabled: boolean
}

// Render's RenderService.updatedAt is the closest proxy to "suspended since"
// — when you suspend a service via dashboard or API the service row is touched.
// It can also bump on unrelated config edits, so the age threshold should be
// generous (default 14 days) to avoid deleting a service the user just toggled.
export async function cleanupSuspendedServices(client: RenderClient, opts: CleanupOptions): Promise<void> {
  let services: RenderService[]
  try {
    services = await client.listServices()
  } catch (err) {
    console.error('[watchdog/cleanup] listServices failed:', err instanceof Error ? err.message : err)
    return
  }

  const cutoff = Date.now() - opts.suspendedDays * 24 * 60 * 60 * 1000
  const candidates: Array<{ svc: RenderService; ageDays: number }> = []

  for (const svc of services) {
    if (svc.suspended !== 'suspended') continue
    if (svc.type === 'redis') continue
    if (opts.selfServiceId && svc.id === opts.selfServiceId) continue
    if (opts.denyList.has(svc.name) || opts.denyList.has(svc.id)) continue

    const updated = svc.updatedAt ? new Date(svc.updatedAt).getTime() : 0
    if (!updated || updated > cutoff) continue

    const ageDays = Math.floor((Date.now() - updated) / (24 * 60 * 60 * 1000))
    candidates.push({ svc, ageDays })
  }

  if (candidates.length === 0) {
    console.log(`[watchdog/cleanup] no suspended services older than ${opts.suspendedDays}d`)
    return
  }

  console.log(`[watchdog/cleanup] ${candidates.length} cleanup candidate(s)${opts.enabled ? '' : ' (dry-run — WATCHDOG_CLEANUP_ENABLED=false)'}`)

  for (const { svc, ageDays } of candidates) {
    await recordEvent({
      service_id: svc.id,
      service_name: svc.name,
      service_type: svc.type,
      kind: 'cleanup_candidate',
      message: `suspended for ~${ageDays}d (threshold ${opts.suspendedDays}d)`,
      metadata: { updated_at: svc.updatedAt, age_days: ageDays, enabled: opts.enabled }
    })

    if (!opts.enabled) {
      await sendTelegram(
        'warning',
        `🧹 cleanup dry-run: ${svc.name}`,
        [
          `Would DELETE ${svc.name} (${svc.type})`,
          `Suspended for ~${ageDays} days (threshold ${opts.suspendedDays}d)`,
          `Service id: ${svc.id}`,
          '',
          'To enable real deletion: set WATCHDOG_CLEANUP_ENABLED=true.',
          `To protect this service: add "${svc.name}" to WATCHDOG_DENYLIST.`
        ].join('\n')
      )
      continue
    }

    try {
      await client.deleteService(svc.id)
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'cleanup_deleted',
        message: `deleted after ~${ageDays}d suspended`,
        metadata: { updated_at: svc.updatedAt, age_days: ageDays }
      })
      await sendTelegram(
        'warning',
        `🗑️ cleanup: deleted ${svc.name}`,
        [
          `Permanently DELETED ${svc.name} (${svc.type})`,
          `Was suspended for ~${ageDays} days`,
          `Service id: ${svc.id}`,
          '',
          'Render delete is irreversible. Re-create from GitHub repo if this was wrong.'
        ].join('\n')
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[watchdog/cleanup] delete failed for ${svc.name}:`, msg)
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'cleanup_error',
        message: `delete failed: ${msg}`
      })
      await sendTelegram(
        'error',
        `🔴 cleanup failed: ${svc.name}`,
        `DELETE call failed for ${svc.id}: ${msg}`
      )
    }
  }
}

export function liveServicesSummary(services: RenderService[]): {
  names: string[]
  ids: string[]
  denylistEnv: string
} {
  const live = services.filter((s) => s.suspended !== 'suspended')
  const names = live.map((s) => s.name).sort()
  const ids = live.map((s) => s.id).sort()
  return {
    names,
    ids,
    denylistEnv: names.join(',')
  }
}

export interface TargetedDeleteOptions {
  selfServiceId?: string
  denyList: Set<string>
  confirm: boolean
}

export interface TargetedDeleteResult {
  matched: Array<{ id: string; name: string; type: string }>
  deleted: Array<{ id: string; name: string }>
  skipped: Array<{ name: string; reason: string }>
  errors: Array<{ name: string; error: string }>
  notFound: string[]
  confirm: boolean
}

// Delete a specific set of services by name (or id). Use this for one-off
// cleanups of failed deploys that aren't suspended (so the periodic cleanup
// pass would otherwise leave them alone). Always dry-runs unless confirm=true.
export async function deleteServicesByNames(
  client: RenderClient,
  targets: string[],
  opts: TargetedDeleteOptions
): Promise<TargetedDeleteResult> {
  const wanted = new Set(targets.map((t) => t.trim()).filter(Boolean))
  const result: TargetedDeleteResult = {
    matched: [],
    deleted: [],
    skipped: [],
    errors: [],
    notFound: [],
    confirm: opts.confirm
  }

  if (wanted.size === 0) return result

  const services = await client.listServices()
  const byNameOrId = new Map<string, RenderService>()
  for (const s of services) {
    byNameOrId.set(s.name, s)
    byNameOrId.set(s.id, s)
  }

  const seen = new Set<string>()
  for (const target of wanted) {
    const svc = byNameOrId.get(target)
    if (!svc) {
      result.notFound.push(target)
      continue
    }
    if (seen.has(svc.id)) continue
    seen.add(svc.id)
    result.matched.push({ id: svc.id, name: svc.name, type: svc.type })

    if (opts.selfServiceId && svc.id === opts.selfServiceId) {
      result.skipped.push({ name: svc.name, reason: 'self (watchdog) — refusing to delete itself' })
      continue
    }
    if (opts.denyList.has(svc.name) || opts.denyList.has(svc.id)) {
      result.skipped.push({ name: svc.name, reason: 'in WATCHDOG_DENYLIST' })
      continue
    }

    await recordEvent({
      service_id: svc.id,
      service_name: svc.name,
      service_type: svc.type,
      kind: 'cleanup_candidate',
      message: opts.confirm ? 'targeted delete — confirmed' : 'targeted delete — dry-run',
      metadata: { source: 'delete-services-endpoint', confirm: opts.confirm }
    })

    if (!opts.confirm) continue

    try {
      await client.deleteService(svc.id)
      result.deleted.push({ id: svc.id, name: svc.name })
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'cleanup_deleted',
        message: 'targeted delete via /delete-services',
        metadata: { source: 'delete-services-endpoint' }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      result.errors.push({ name: svc.name, error: msg })
      await recordEvent({
        service_id: svc.id,
        service_name: svc.name,
        service_type: svc.type,
        kind: 'cleanup_error',
        message: `targeted delete failed: ${msg}`
      })
    }
  }

  if (opts.confirm && result.deleted.length > 0) {
    await sendTelegram(
      'warning',
      `🗑️ targeted cleanup: deleted ${result.deleted.length} service(s)`,
      [
        `Deleted: ${result.deleted.map((d) => d.name).join(', ')}`,
        result.errors.length > 0 ? `Errors: ${result.errors.map((e) => `${e.name} (${e.error})`).join(', ')}` : '',
        result.skipped.length > 0 ? `Skipped: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}` : ''
      ]
        .filter(Boolean)
        .join('\n')
    )
  } else if (!opts.confirm && result.matched.length > 0) {
    await sendTelegram(
      'info',
      `🔎 targeted cleanup dry-run: ${result.matched.length} match(es)`,
      [
        `Would delete: ${result.matched.filter((m) => !result.skipped.find((s) => s.name === m.name)).map((m) => m.name).join(', ')}`,
        result.skipped.length > 0 ? `Skipped: ${result.skipped.map((s) => `${s.name} (${s.reason})`).join(', ')}` : '',
        result.notFound.length > 0 ? `Not found: ${result.notFound.join(', ')}` : '',
        '',
        'Re-call with ?confirm=true to actually delete.'
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  return result
}
