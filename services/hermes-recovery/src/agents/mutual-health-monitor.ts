import { getSupabase } from '../connectors/supabase'
import { logger } from '../core/logger'
import { CONFIG } from '../core/config'

const log = logger.child({ agent: 'mutual-health-monitor' })

interface ServiceHealth {
  service: string
  uptime_ms: number
  workers_active: number
  queue_depth: number
  health_score: number
  last_error_at?: string
}

export async function startMutualHealthMonitor(subagentId: string) {
  const db = getSupabase()

  const services = [
    { name: 'youtube-engine', url: 'http://localhost:3001' },
    { name: 'content-worker', url: 'http://localhost:3002' },
    { name: 'planning-engine', url: 'http://localhost:3003' },
  ]

  setInterval(async () => {
    try {
      // Check health of each service
      for (const service of services) {
        let isHealthy = false
        let healthData: Partial<ServiceHealth> = { service: service.name, health_score: 0 }

        try {
          const response = await fetch(`${service.url}/hermes/health`, {
            timeout: 5000,
          })

          if (response.ok) {
            healthData = await response.json()
            const score = (healthData.health_score || 0) as number
            isHealthy = score >= 70
          }
        } catch (err) {
          log.warn({ service: service.name, err }, 'Health check failed')
        }

        // Update mutual health table
        const { data: existing } = await db
          .from('hermes.mutual_health')
          .select('id')
          .eq('monitor_agent_id', 'hermes-recovery')
          .eq('monitored_service', service.name)
          .single()

        if (existing) {
          await db
            .from('hermes.mutual_health')
            .update({
              last_heartbeat_at: new Date().toISOString(),
              is_healthy: isHealthy,
              health_score: (healthData.health_score as number) || 0,
              failure_count: isHealthy ? 0 : 1,
            })
            .eq('id', existing.id)
        } else {
          await db.from('hermes.mutual_health').insert({
            monitor_agent_id: 'hermes-recovery',
            monitored_service: service.name,
            is_healthy: isHealthy,
            health_score: (healthData.health_score as number) || 0,
            last_heartbeat_at: new Date().toISOString(),
            failure_count: isHealthy ? 0 : 1,
          })
        }

        // Check for cascade failures
        const { data: allHealth } = await db
          .from('hermes.mutual_health')
          .select('monitored_service, health_score, is_healthy')

        if (allHealth && allHealth.length > 0) {
          const unhealthyCount = allHealth.filter((h) => !h.is_healthy).length
          const totalCount = allHealth.length

          if (unhealthyCount > totalCount / 2) {
            log.error(
              { unhealthyCount, totalCount },
              'MUTUAL FAILURE CASCADE DETECTED - most services unhealthy'
            )

            // Send critical alert
            try {
              await sendTelegramAlert(
                `🔴 CRITICAL: Mutual Failure Cascade\n` +
                  `${unhealthyCount}/${totalCount} services unhealthy\n` +
                  `Recovery agent health score: ${healthData.health_score}`
              )
            } catch (err) {
              log.warn({ err }, 'Failed to send cascade alert')
            }
          }
        }
      }

      // Also register Hermes' own health in the mutual_health table
      // so other services can monitor this agent
      const { data: hermesHealth } = await db
        .from('hermes.mutual_health')
        .select('id')
        .eq('monitor_agent_id', 'hermes-recovery')
        .eq('monitored_service', 'hermes-recovery')
        .single()

      const hermesHealthScore = 95 // Hermes itself is healthy if running
      if (hermesHealth) {
        await db
          .from('hermes.mutual_health')
          .update({
            last_heartbeat_at: new Date().toISOString(),
            is_healthy: true,
            health_score: hermesHealthScore,
          })
          .eq('id', hermesHealth.id)
      } else {
        await db.from('hermes.mutual_health').insert({
          monitor_agent_id: 'hermes-recovery',
          monitored_service: 'hermes-recovery',
          is_healthy: true,
          health_score: hermesHealthScore,
          last_heartbeat_at: new Date().toISOString(),
          failure_count: 0,
        })
      }
    } catch (err) {
      log.error({ err }, 'Health monitoring loop error')
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL_MS)

  log.info('Mutual health monitor started')
}

async function sendTelegramAlert(message: string) {
  if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
    log.warn('Telegram config missing')
    return
  }

  const response = await fetch(`https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CONFIG.TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    }),
  })

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status}`)
  }
}
