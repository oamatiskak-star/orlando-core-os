import { spawn } from 'child_process'

/**
 * ReasoningBank — sla leer-trajectories op in AgentDB via de ruflo CLI.
 *
 * Een trajectory is de gecombineerde ervaring van één video-project na afloop
 * van de learning-loop: niche, format, behaalde metrics, uitkomst-verdict.
 * De ruflo-swarm gebruikt deze patronen om toekomstige content-beslissingen
 * te onderbouwen (retrieve via swarm-orchestrator, namespace orlando:trajectory:*).
 *
 * Alle functies zijn FIRE-AND-FORGET: ze loggen fouten maar gooien nooit,
 * zodat de learning-loop blijft draaien als ruflo niet beschikbaar is.
 */

const RUFLO_BIN         = process.env.RUFLO_BIN || 'npx'
const RUFLO_ARGS_PREFIX = process.env.RUFLO_BIN ? [] : ['ruflo@latest']
const TIMEOUT_MS        = 15_000

export interface Trajectory {
  project_id:           string
  niche:                string | null
  format:               string | null
  channel_id:           string | null
  learning_status:      string
  verdict:              'success' | 'failed' | 'pending'
  metrics: {
    avg_ctr:       number | null
    avg_retention: number | null
    revenue:       number | null
  }
  checkpoints_collected: number
  recorded_at:          string
}

/** Bepaal het verdict op basis van verzamelde metrics. */
export function deriveVerdict(
  learningStatus: string,
  avgCtr: number | null,
  revenue: number | null,
): Trajectory['verdict'] {
  if (learningStatus !== 'completed') return 'pending'
  // Success: omzet positief OF CTR boven de 4% drempel (branche-gemiddelde YouTube finance NL)
  if ((revenue != null && revenue > 0) || (avgCtr != null && avgCtr >= 0.04)) return 'success'
  // Completed maar geen signaal: failed (zodat swarm dit patroon kan vermijden)
  if (avgCtr != null || revenue != null) return 'failed'
  return 'pending'  // nog geen echte metrics beschikbaar
}

function rufloStore(key: string, value: string): void {
  const args = [...RUFLO_ARGS_PREFIX, 'memory', 'store', '--key', key, '--value', value]
  const proc = spawn(RUFLO_BIN, args, {
    env: { ...process.env, NODE_NO_WARNINGS: '1' },
    stdio: 'ignore',
  })
  const timer = setTimeout(() => proc.kill(), TIMEOUT_MS)
  proc.on('close', () => clearTimeout(timer))
  proc.on('error', () => clearTimeout(timer))  // ruflo niet geïnstalleerd → stil negeren
}

/**
 * Sla een volledig trajectory op in AgentDB.
 * Sleutel: `orlando:trajectory:<project_id>`
 * Namespace-patroon: de swarm-orchestrator haalt ze op via query "orlando trajectory".
 */
export function storeTrajectory(t: Trajectory): void {
  try {
    rufloStore(`orlando:trajectory:${t.project_id}`, JSON.stringify(t))
  } catch {
    // nooit gooien — learning loop mag hier niet op stuklopen
  }
}

/**
 * Sla een verdict-samenvatting op per niche×format-combinatie (geaggregeerd patroon).
 * Sleutel: `orlando:verdict:<niche>:<format>:<datum>`
 * Gebruik: swarm-agents kunnen dit ophalen voor content-strategie.
 */
export function storeVerdictPattern(
  niche: string | null,
  format: string | null,
  verdict: Trajectory['verdict'],
  avgCtr: number | null,
  revenue: number | null,
): void {
  if (!niche && !format) return
  const key   = `orlando:verdict:${niche ?? 'unknown'}:${format ?? 'unknown'}:${new Date().toISOString().slice(0, 10)}`
  const value = JSON.stringify({ niche, format, verdict, avg_ctr: avgCtr, revenue, recorded_at: new Date().toISOString() })
  try {
    rufloStore(key, value)
  } catch {
    // silent
  }
}
