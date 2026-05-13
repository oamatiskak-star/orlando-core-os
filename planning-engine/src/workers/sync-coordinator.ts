import simpleGit, { SimpleGit } from 'simple-git'
import { workerLogger } from '../lib/logger'
import { getSupabase, logSync, logBottleneck } from '../lib/supabase'
import { sendTelegram } from '../lib/notifications'
import path from 'path'
import fs from 'fs'

const log = workerLogger('sync-coordinator')

const REPOS = [
  { name: 'orlando-core-os',        path: process.env.REPO_ORLANDO_CORE ?? '/Users/bouwproffsnederlandbv/Github/orlando-core-os' },
  { name: 'sterkbouw-saas-front',   path: process.env.REPO_STERKBOUW    ?? '/Users/bouwproffsnederlandbv/Github/sterkbouw-saas-front' },
  { name: 'vastgoedscalper-saas',   path: process.env.REPO_VASTGOED     ?? '/Users/bouwproffsnederlandbv/Github/vastgoedscapler-saas' },
]

const MACHINE = process.env.MACHINE_ID ?? 'mac_mini_1'

async function pullRepo(repoPath: string, repoName: string): Promise<{
  success: boolean
  commitHash?: string
  behind?: number
  error?: string
}> {
  if (!fs.existsSync(repoPath)) {
    return { success: false, error: `Path not found: ${repoPath}` }
  }

  const git: SimpleGit = simpleGit(repoPath)
  const start = Date.now()

  try {
    await git.fetch()
    const status = await git.status()
    const behind = status.behind

    if (behind > 0) {
      log.info(`${repoName} is ${behind} commits behind — pulling`, { repoPath })
      await git.pull('origin', status.current ?? 'main')
    }

    const log_ = await git.log({ maxCount: 1 })
    const commitHash = log_.latest?.hash?.slice(0, 8)

    await logSync({
      machine: MACHINE,
      sync_type: 'git_pull',
      status: 'success',
      branch: status.current ?? 'main',
      commit_hash: commitHash,
      details: { repo: repoName, behind, pulled: behind > 0 },
      duration_ms: Date.now() - start,
    })

    return { success: true, commitHash, behind }
  } catch (err) {
    const error = (err as Error).message
    log.error(`Git pull failed for ${repoName}`, { error })

    await logSync({
      machine: MACHINE,
      sync_type: 'git_pull',
      status: 'failed',
      error,
      details: { repo: repoName },
      duration_ms: Date.now() - start,
    })

    return { success: false, error }
  }
}

async function detectStaleDeployments(): Promise<void> {
  const db = getSupabase()

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: recentSyncs } = await db
    .from('oc_system_sync_log')
    .select('sync_type, machine, created_at, status')
    .in('sync_type', ['vercel_deploy', 'render_deploy'])
    .gte('created_at', thirtyMinutesAgo)
    .eq('status', 'success')

  if (!recentSyncs || recentSyncs.length === 0) {
    await logBottleneck({
      bottleneck_type: 'deployment_stale',
      severity: 'low',
      description: 'Geen succesvolle deployment in de afgelopen 30 minuten — check Vercel/Render status',
    })
  }
}

async function detectContextStale(): Promise<void> {
  const db = getSupabase()
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { data: recentContextSync } = await db
    .from('oc_system_sync_log')
    .select('id')
    .eq('sync_type', 'context_sync')
    .gte('created_at', oneHourAgo)
    .limit(1)

  if (!recentContextSync || recentContextSync.length === 0) {
    await logBottleneck({
      bottleneck_type: 'context_stale',
      severity: 'medium',
      description: 'Agent context niet gesynchroniseerd in > 1 uur — memory/context drift risico',
    })
  }
}

export async function runSyncCoordinator(): Promise<void> {
  log.info('Sync coordinator starting', { machine: MACHINE })

  const results: Array<{ repo: string; success: boolean; behind?: number; error?: string }> = []

  for (const repo of REPOS) {
    const result = await pullRepo(repo.path, repo.name)
    results.push({ repo: repo.name, ...result })

    if (!result.success) {
      await logBottleneck({
        bottleneck_type: 'context_stale',
        severity: 'medium',
        description: `Git pull failed: ${repo.name} — ${result.error}`,
      })
    }

    if ((result.behind ?? 0) > 10) {
      await logBottleneck({
        bottleneck_type: 'context_stale',
        severity: 'high',
        description: `${repo.name} is ${result.behind} commits behind — grote sync nodig`,
      })
      await sendTelegram(`⚠️ <b>Sync Alert</b>\n\n${repo.name} is ${result.behind} commits achter op ${MACHINE}`)
    }
  }

  await detectStaleDeployments()
  await detectContextStale()

  const failed = results.filter(r => !r.success)
  if (failed.length > 0) {
    log.warn('Some repos failed to sync', { failed: failed.map(f => f.repo) })
  } else {
    log.info('All repos synced', { repos: results.length })
  }
}
