import 'dotenv/config'
import Dockerode from 'dockerode'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL       = process.env.SUPABASE_URL!
const SUPABASE_KEY       = process.env.SUPABASE_SERVICE_ROLE_KEY!
const NODE_ID            = process.env.NODE_ID ?? 'cli-r'
const POLL_MS            = parseInt(process.env.POLL_INTERVAL_MS ?? '30000', 10)

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const docker   = new Dockerode({ socketPath: '/var/run/docker.sock' })

// Label used to identify Orlando services in docker-compose.cli-r.yml
const ORLANDO_LABEL = 'orlando.service'

interface ContainerMetrics {
  worker_id:    string
  node:         string
  status:       'online' | 'offline' | 'degraded'
  cpu_pct:      number
  ram_mb:       number
  ram_total_mb: number
  version:      string | null
}

async function getContainerMetrics(): Promise<ContainerMetrics[]> {
  const containers = await docker.listContainers({ all: false })
  const metrics: ContainerMetrics[] = []

  for (const info of containers) {
    const serviceName = info.Labels?.[ORLANDO_LABEL]
    if (!serviceName) continue

    try {
      const container = docker.getContainer(info.Id)
      const stats: any = await new Promise((resolve, reject) => {
        container.stats({ stream: false }, (err, data) => {
          if (err) reject(err)
          else resolve(data)
        })
      })

      const cpuDelta    = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage
      const numCpus     = stats.cpu_stats.online_cpus ?? stats.cpu_stats.cpu_usage.percpu_usage?.length ?? 1
      const cpuPct      = systemDelta > 0 ? (cpuDelta / systemDelta) * numCpus * 100 : 0

      const ramMb      = Math.round(stats.memory_stats.usage / 1024 / 1024)
      const ramTotalMb = Math.round(stats.memory_stats.limit / 1024 / 1024)

      const state  = info.State
      const status: 'online' | 'offline' | 'degraded' =
        state === 'running' ? (cpuPct > 90 ? 'degraded' : 'online') : 'offline'

      metrics.push({
        worker_id:    serviceName,
        node:         NODE_ID,
        status,
        cpu_pct:      Math.round(cpuPct * 100) / 100,
        ram_mb:       ramMb,
        ram_total_mb: ramTotalMb,
        version:      null,
      })
    } catch {
      // Container might have just stopped — report as offline
      metrics.push({
        worker_id:    serviceName,
        node:         NODE_ID,
        status:       'offline',
        cpu_pct:      0,
        ram_mb:       0,
        ram_total_mb: 0,
        version:      null,
      })
    }
  }

  return metrics
}

async function getQueueDepths(): Promise<Record<string, number>> {
  const depths: Record<string, number> = {}

  const [ytQueue, orchQueue, mailQueue] = await Promise.all([
    supabase
      .from('youtube_upload_queue')
      .select('id', { count: 'exact', head: true })
      .not('status', 'in', '("verified_live","cancelled","failed")'),
    supabase
      .from('orchestrator_tasks')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    supabase
      .from('mail_send_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  depths['youtube-engine']   = ytQueue.count   ?? 0
  depths['planning-engine']  = orchQueue.count  ?? 0
  depths['mail-engine']      = mailQueue.count  ?? 0

  return depths
}

async function poll() {
  try {
    const [metrics, depths] = await Promise.all([
      getContainerMetrics(),
      getQueueDepths(),
    ])

    if (metrics.length === 0) {
      console.log(`[monitoring] No Orlando containers found — is docker-compose.cli-r.yml running?`)
      return
    }

    const rows = metrics.map(m => ({
      ...m,
      queue_depth: depths[m.worker_id] ?? 0,
      updated_at:  new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('infra_workers')
      .upsert(rows, { onConflict: 'worker_id' })

    if (error) {
      console.error('[monitoring] Supabase upsert error:', error.message)
    } else {
      console.log(`[monitoring] ${rows.length} workers gerapporteerd — ${new Date().toISOString()}`)
      for (const r of rows) {
        console.log(`  ${r.worker_id}: ${r.status} CPU:${r.cpu_pct}% RAM:${r.ram_mb}MB Q:${r.queue_depth}`)
      }
    }
  } catch (err: any) {
    console.error('[monitoring] Poll error:', err?.message ?? err)
  }
}

async function main() {
  console.log(`[monitoring] Orlando Monitoring Agent — node:${NODE_ID} — interval:${POLL_MS}ms`)

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('[monitoring] SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist')
    process.exit(1)
  }

  await poll()
  setInterval(poll, POLL_MS)
}

main().catch(err => {
  console.error('[monitoring] Fatal:', err)
  process.exit(1)
})
