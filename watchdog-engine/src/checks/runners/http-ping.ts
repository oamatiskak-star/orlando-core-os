import axios from 'axios'
import { CheckResult, CheckRow } from '../types'

export async function runHttpPing(check: CheckRow): Promise<CheckResult> {
  const url = String(check.config.url ?? '')
  if (!url) return { ok: false, message: 'config.url missing' }
  const timeout = Number(check.config.timeout_ms ?? 8000)
  const maxLatency = Number(check.threshold.max_latency_ms ?? 0)
  const expectStatus = Array.isArray(check.config.expect_status)
    ? (check.config.expect_status as number[])
    : [200, 204]

  const start = Date.now()
  try {
    const res = await axios.get(url, { timeout, validateStatus: () => true })
    const latency = Date.now() - start
    if (!expectStatus.includes(res.status)) {
      return {
        ok: false,
        latency_ms: latency,
        message: `unexpected status ${res.status}`,
        metadata: { status: res.status, body: String(res.data).slice(0, 500) }
      }
    }
    if (maxLatency > 0 && latency > maxLatency) {
      return {
        ok: false,
        latency_ms: latency,
        message: `latency ${latency}ms exceeds threshold ${maxLatency}ms`,
        metadata: { status: res.status }
      }
    }
    return { ok: true, latency_ms: latency, metadata: { status: res.status } }
  } catch (err) {
    const latency = Date.now() - start
    return {
      ok: false,
      latency_ms: latency,
      message: err instanceof Error ? err.message : String(err)
    }
  }
}
