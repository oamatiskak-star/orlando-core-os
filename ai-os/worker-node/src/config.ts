function env(name: string, fallback?: string): string {
  const v = process.env[name]
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback
    throw new Error(`Missing env: ${name}`)
  }
  return v
}

function envInt(name: string, fb: number): number {
  const n = parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(n) ? n : fb
}

function envList(name: string, fb: string[] = []): string[] {
  const v = process.env[name]
  if (!v) return fb
  return v.split(',').map(s => s.trim()).filter(Boolean)
}

export const config = {
  nodeId: env('AI_NODE_ID', `worker-${process.pid}`),
  hostname: env('HOSTNAME', 'localhost'),
  role: env('AI_NODE_ROLE', 'worker') as 'brain' | 'worker' | 'gpu' | 'cloud',

  routerUrl: env('AI_ROUTER_URL', 'http://localhost:8787'),
  routerKey: env('AI_ROUTER_API_KEY', 'change-me-router-key'),

  supabase: {
    url: env('SUPABASE_URL'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
  },

  pollIntervalMs: envInt('AI_WORKER_POLL_MS', 2000),
  leaseSeconds: envInt('AI_WORKER_LEASE_S', 180),
  concurrency: envInt('AI_WORKER_CONCURRENCY', 4),
  kinds: envList('AI_WORKER_KINDS'), // empty = accept all
  heartbeatMs: envInt('AI_WORKER_HEARTBEAT_MS', 15_000),
}
